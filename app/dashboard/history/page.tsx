import { createClient } from "@/lib/supabase/server";
import { Nav } from "../Nav";
import { STATUS_LABEL } from "../labels";

export const dynamic = "force-dynamic";

type Message = { role: string; content: string; created_at: string };
type ConversationRow = {
  id: string;
  patient_name: string;
  rut: string;
  summary: string | null;
  status: string;
  created_at: string;
  messages: Message[];
};

export default async function HistoryPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("conversations")
    .select("id, patient_name, rut, summary, status, created_at, messages(role, content, created_at)")
    .order("created_at", { ascending: false })
    .limit(200);

  const conversations = (data ?? []) as unknown as ConversationRow[];

  return (
    <div className="flex flex-1 flex-col">
      <Nav />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-3 p-4">
        <h1 className="text-lg font-semibold">Historial de consultas</h1>

        {conversations.length === 0 && (
          <p className="text-sm text-zinc-500">Aún no hay consultas.</p>
        )}

        {conversations.map((c) => {
          const messages = [...(c.messages ?? [])].sort((x, y) =>
            x.created_at.localeCompare(y.created_at),
          );
          return (
            <article
              key={c.id}
              className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/15 dark:bg-zinc-900"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{c.patient_name}</p>
                  <p className="text-sm text-zinc-500">{c.rut}</p>
                </div>
                <div className="text-right text-xs text-zinc-500">
                  <p>{STATUS_LABEL[c.status] ?? c.status}</p>
                  <p>{new Date(c.created_at).toLocaleString("es-CL")}</p>
                </div>
              </div>

              {c.summary && (
                <p className="mt-2 text-sm">
                  <span className="font-medium">Resumen: </span>
                  {c.summary}
                </p>
              )}

              <details className="mt-2">
                <summary className="cursor-pointer text-sm text-zinc-600 dark:text-zinc-400">
                  Ver conversación completa
                </summary>
                <div className="mt-2 space-y-2 rounded-lg bg-zinc-50 p-3 text-sm dark:bg-zinc-800">
                  {messages.map((m, i) => (
                    <p key={i}>
                      <span className="font-medium">
                        {m.role === "user" ? "Usuario: " : "Asistente: "}
                      </span>
                      <span className="whitespace-pre-wrap">{m.content}</span>
                    </p>
                  ))}
                </div>
              </details>
            </article>
          );
        })}
      </main>
    </div>
  );
}
