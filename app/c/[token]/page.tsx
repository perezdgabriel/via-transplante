"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Msg = { role: "user" | "assistant" | "nurse"; content: string };

// ponytail: minimal inline markdown — bold/italic are the only modifiers the AI emits. Not a full
// parser. Builds React nodes (no dangerouslySetInnerHTML), so text stays escaped and safe.
function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|\*(.+?)\*/g;
  let last = 0;
  let k = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(
      m[1] !== undefined ? (
        <strong key={k++}>{m[1]}</strong>
      ) : (
        <em key={k++}>{m[2]}</em>
      ),
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export default function ChatPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [convId, setConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [escalated, setEscalated] = useState(false);
  const [closed, setClosed] = useState(false);
  const [certificateAvailable, setCertificateAvailable] = useState(false);
  // ponytail: folleto cards are live-only (not persisted); the "📄 título" text line survives a reload.
  const [folletos, setFolletos] = useState<
    { id: string; title: string; url: string | null }[]
  >([]);
  const [notFound, setNotFound] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // Remember this session so a returning user on the same device lands back here.
  useEffect(() => {
    localStorage.setItem("lastConversation", token);
  }, [token]);

  // Fetch the server transcript and adopt it when it has more turns than we do (so it never
  // clobbers an optimistic message that hasn't persisted yet). ponytail: length-based adopt.
  const refresh = useCallback(async () => {
    try {
      const r = await fetch(`/api/conversations/${token}`);
      if (!r.ok) return;
      const data = await r.json();
      setMessages((prev) =>
        data.messages.length > prev.length ? data.messages : prev,
      );
      if (data.status === "resolved") setClosed(true);
    } catch {
      /* transient; a later Realtime event or poll retries */
    }
  }, [token]);

  // Load transcript on mount.
  useEffect(() => {
    fetch(`/api/conversations/${token}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        setConvId(data.id);
        setMessages(data.messages);
        setEscalated(data.status === "escalated");
        setClosed(data.status === "resolved");
        setCertificateAvailable(Boolean(data.certificateAvailable));
      })
      .catch(() => setNotFound(true));
  }, [token]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Realtime (fast path): the patient's anonymous session receives inserts on its own conversation
  // (RLS scopes messages to owner_id = auth.uid()). Any insert triggers a transcript refresh.
  useEffect(() => {
    if (!convId || closed) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`chat-${convId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${convId}`,
        },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [convId, closed, refresh]);

  // Fallback poll (~15s) while a nurse is handling it, in case Realtime isn't connected.
  useEffect(() => {
    if (!escalated || closed) return;
    const id = setInterval(refresh, 15000);
    return () => clearInterval(id);
  }, [escalated, closed, refresh]);

  // Pure updater: replace the last (assistant) message; never mutate the existing object.
  function appendToLast(text: string) {
    setMessages((m) => {
      const last = m[m.length - 1];
      return [...m.slice(0, -1), { ...last, content: last.content + text }];
    });
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    setInput("");
    setSending(true);

    // Once escalated a nurse is handling it: deliver the message, no AI turn/placeholder.
    if (escalated) {
      setMessages((m) => [...m, { role: "user", content: text }]);
      try {
        await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, message: text }),
        });
      } catch {
        /* delivered on retry; nurse also sees the transcript */
      } finally {
        setSending(false);
      }
      return;
    }

    setMessages((m) => [
      ...m,
      { role: "user", content: text },
      { role: "assistant", content: "" },
    ]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, message: text }),
      });
      if (!res.body) throw new Error();

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const raw of lines) {
          if (!raw.trim()) continue;
          const evt = JSON.parse(raw) as {
            type: string;
            text?: string;
            id?: string;
            title?: string;
            url?: string | null;
          };
          if (evt.type === "text" && evt.text) {
            appendToLast(evt.text);
          } else if (evt.type === "escalated") {
            setEscalated(true);
          } else if (evt.type === "certificate") {
            setCertificateAvailable(true);
          } else if (evt.type === "folleto" && evt.id && evt.title) {
            setFolletos((f) =>
              f.some((x) => x.id === evt.id)
                ? f
                : [
                    ...f,
                    { id: evt.id!, title: evt.title!, url: evt.url ?? null },
                  ],
            );
          } else if (evt.type === "error" && evt.text) {
            appendToLast(evt.text);
          }
        }
      }
    } catch {
      appendToLast("Ocurrió un error. Intenta nuevamente.");
    } finally {
      setSending(false);
    }
  }

  if (notFound) {
    return (
      <main className="flex flex-1 items-center justify-center p-4 text-center">
        <p className="text-zinc-600 dark:text-zinc-400">
          No encontramos esta conversación.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col">
      <header className="border-b border-black/10 px-4 py-3 dark:border-white/15">
        <h1 className="font-semibold">Vía Transplante</h1>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((m, i) => (
          <div
            key={i}
            className={
              m.role === "user"
                ? "flex justify-end"
                : "flex flex-col items-start"
            }
          >
            {m.role === "nurse" && (
              <span className="mb-1 ml-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                Enfermera
              </span>
            )}
            <div
              className={
                "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm " +
                (m.role === "user"
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                  : m.role === "nurse"
                    ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
                    : "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100")
              }
            >
              {m.content ? renderInline(m.content) : "…"}
            </div>
          </div>
        ))}
        {escalated && !closed && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-center text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">
            Tu caso fue derivado a una enfermera. Ya no responde el asistente
            virtual: puedes seguir escribiendo aquí y una enfermera te
            responderá por este chat.
          </p>
        )}
        {closed && (
          <p className="rounded-lg bg-zinc-100 px-3 py-2 text-center text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            Esta conversación fue cerrada. Si necesitas ayuda,{" "}
            <Link href="/" className="font-medium underline">
              inicia una nueva consulta
            </Link>
            .
          </p>
        )}
        {folletos.map((f) => (
          <div key={f.id} className="flex justify-center">
            {f.url ? (
              <a
                href={f.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-sky-300 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-800 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200"
              >
                📄 {f.title}
              </a>
            ) : (
              <span className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                📄 {f.title} (próximamente)
              </span>
            )}
          </div>
        ))}
        {certificateAvailable && (
          <div className="flex justify-center">
            <a
              href={`/api/certificate/${token}`}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              Descargar certificado
            </a>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={send}
        className="flex gap-2 border-t border-black/10 p-3 dark:border-white/15"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends; Shift+Enter inserts a newline (textarea default).
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(e);
            }
          }}
          rows={1}
          className="max-h-32 flex-1 resize-none rounded-lg border border-black/15 px-3 py-2 dark:border-white/20 dark:bg-zinc-800"
          placeholder={
            closed
              ? "Conversación cerrada"
              : escalated
                ? "Escribe a la enfermera…"
                : "Escribe tu mensaje…"
          }
          disabled={sending || closed}
        />
        <button
          type="submit"
          disabled={sending || closed || !input.trim()}
          className="rounded-lg bg-zinc-900 px-4 py-2 font-medium text-white disabled:opacity-60 dark:bg-white dark:text-zinc-900"
        >
          Enviar
        </button>
      </form>
    </main>
  );
}
