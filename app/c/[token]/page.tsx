"use client";

import { use, useEffect, useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };

export default function ChatPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [escalated, setEscalated] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // Remember this session so a returning user on the same device lands back here.
  useEffect(() => {
    localStorage.setItem("lastConversation", token);
  }, [token]);

  // Load transcript on mount.
  useEffect(() => {
    fetch(`/api/conversations/${token}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        setMessages(data.messages);
        setEscalated(data.status === "escalated");
      })
      .catch(() => setNotFound(true));
  }, [token]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    setInput("");
    setSending(true);
    setMessages((m) => [...m, { role: "user", content: text }, { role: "assistant", content: "" }]);

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
          const evt = JSON.parse(raw) as { type: string; text?: string };
          if (evt.type === "text" && evt.text) {
            setMessages((m) => {
              const copy = [...m];
              copy[copy.length - 1].content += evt.text;
              return copy;
            });
          } else if (evt.type === "escalated") {
            setEscalated(true);
          } else if (evt.type === "error" && evt.text) {
            setMessages((m) => {
              const copy = [...m];
              copy[copy.length - 1].content += evt.text;
              return copy;
            });
          }
        }
      }
    } catch {
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1].content += "Ocurrió un error. Intenta nuevamente.";
        return copy;
      });
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
        <h1 className="font-semibold">Asistencia Pediátrica</h1>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((m, i) => (
          <div
            key={i}
            className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
          >
            <div
              className={
                "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm " +
                (m.role === "user"
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                  : "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100")
              }
            >
              {m.content || "…"}
            </div>
          </div>
        ))}
        {escalated && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-center text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">
            Tu caso fue derivado a una enfermera, que revisará y te contactará.
          </p>
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={send} className="flex gap-2 border-t border-black/10 p-3 dark:border-white/15">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 rounded-lg border border-black/15 px-3 py-2 dark:border-white/20 dark:bg-zinc-800"
          placeholder="Escribe tu mensaje…"
          disabled={sending}
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="rounded-lg bg-zinc-900 px-4 py-2 font-medium text-white disabled:opacity-60 dark:bg-white dark:text-zinc-900"
        >
          Enviar
        </button>
      </form>
    </main>
  );
}
