import { createClient } from "@/lib/supabase/server";
import { Nav } from "./Nav";
import { AlertsRealtime } from "./AlertsRealtime";
import { reclassifyPriority, resolveAlert, replyToUser } from "./actions";
import { PRIORITY_LABEL, PRIORITY_STYLE, ROLE_LABEL } from "./labels";

export const dynamic = "force-dynamic";

type Message = { role: string; content: string; created_at: string };
type AlertRow = {
  id: string;
  priority: string;
  created_at: string;
  conversation_id: string;
  conversations: {
    patient_name: string;
    rut: string;
    summary: string | null;
    messages: Message[];
  } | null;
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("alerts")
    .select(
      "id, priority, created_at, conversation_id, conversations(patient_name, rut, summary, messages(role, content, created_at))",
    )
    .eq("status", "active")
    .order("created_at", { ascending: true });

  const alerts = (data ?? []) as unknown as AlertRow[];

  return (
    <div className="flex flex-1 flex-col">
      <Nav />
      <AlertsRealtime />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-4 p-4">
        <h1 className="text-lg font-semibold">Avisos activos ({alerts.length})</h1>

        {alerts.length === 0 && (
          <p className="text-sm text-zinc-500">No hay avisos activos.</p>
        )}

        {alerts.map((a) => {
          const conv = a.conversations;
          const messages = [...(conv?.messages ?? [])].sort((x, y) =>
            x.created_at.localeCompare(y.created_at),
          );
          return (
            <article
              key={a.id}
              className="rounded-2xl border border-black/10 bg-white p-4 dark:border-white/15 dark:bg-zinc-900"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{conv?.patient_name}</p>
                  <p className="text-sm text-zinc-500">{conv?.rut}</p>
                </div>
                <span
                  className={
                    "rounded-full px-2.5 py-0.5 text-xs font-medium " +
                    (PRIORITY_STYLE[a.priority] ?? "")
                  }
                >
                  {PRIORITY_LABEL[a.priority] ?? a.priority}
                </span>
              </div>

              {conv?.summary && (
                <p className="mt-3 text-sm">
                  <span className="font-medium">Resumen: </span>
                  {conv.summary}
                </p>
              )}

              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-zinc-600 dark:text-zinc-400">
                  Ver conversación completa
                </summary>
                <div className="mt-2 space-y-2 rounded-lg bg-zinc-50 p-3 text-sm dark:bg-zinc-800">
                  {messages.map((m, i) => (
                    <p key={i}>
                      <span className="font-medium">
                        {(ROLE_LABEL[m.role] ?? m.role) + ": "}
                      </span>
                      <span className="whitespace-pre-wrap">{m.content}</span>
                    </p>
                  ))}
                </div>
              </details>

              <div className="mt-4 flex flex-col gap-3 border-t border-black/10 pt-3 dark:border-white/15 sm:flex-row sm:items-end">
                <form action={reclassifyPriority} className="flex items-end gap-2">
                  <input type="hidden" name="alertId" value={a.id} />
                  <label className="text-sm">
                    <span className="block text-zinc-500">Prioridad</span>
                    <select
                      name="priority"
                      defaultValue={a.priority}
                      className="mt-1 rounded-lg border border-black/15 px-2 py-1.5 dark:border-white/20 dark:bg-zinc-800"
                    >
                      <option value="urgent">Urgente</option>
                      <option value="normal">Normal</option>
                      <option value="informative">Informativo</option>
                    </select>
                  </label>
                  <button className="rounded-lg border border-black/15 px-3 py-1.5 text-sm dark:border-white/20">
                    Actualizar
                  </button>
                </form>

                <form action={resolveAlert} className="flex flex-1 items-end gap-2">
                  <input type="hidden" name="alertId" value={a.id} />
                  <input type="hidden" name="conversationId" value={a.conversation_id} />
                  <label className="flex-1 text-sm">
                    <span className="block text-zinc-500">Nota interna (opcional)</span>
                    <input
                      name="note"
                      className="mt-1 w-full rounded-lg border border-black/15 px-2 py-1.5 dark:border-white/20 dark:bg-zinc-800"
                      placeholder="Ej: resuelto por llamada telefónica"
                    />
                  </label>
                  <button className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-white dark:text-zinc-900">
                    Resolver
                  </button>
                </form>
              </div>

              <form action={replyToUser} className="mt-3 flex items-end gap-2">
                <input type="hidden" name="conversationId" value={a.conversation_id} />
                <label className="flex-1 text-sm">
                  <span className="block text-zinc-500">Responder por chat</span>
                  <input
                    name="content"
                    required
                    className="mt-1 w-full rounded-lg border border-black/15 px-2 py-1.5 dark:border-white/20 dark:bg-zinc-800"
                    placeholder="Mensaje para el usuario…"
                  />
                </label>
                <button className="rounded-lg border border-black/15 px-3 py-1.5 text-sm dark:border-white/20">
                  Enviar
                </button>
              </form>
            </article>
          );
        })}
      </main>
    </div>
  );
}
