import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Nav } from "../../Nav";
import { STATUS_LABEL, ROLE_LABEL } from "../../labels";
import { PatientLink } from "../PatientLink";
import { RecordForm } from "../RecordForm";
import { parseMedications, type PatientRecord } from "@/lib/patient-record";

export const dynamic = "force-dynamic";

type Message = { role: string; content: string; created_at: string };
type ConversationRow = {
  id: string;
  summary: string | null;
  status: string;
  created_at: string;
  messages: Message[];
};
type PatientRow = PatientRecord & {
  id: string;
  token: string;
  name: string;
  rut: string;
};

export default async function PatientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("patients")
    .select(
      "id, token, name, rut, next_appointment_at, next_appointment_place, medications, allergies, restrictions, record_source, record_synced_at",
    )
    .eq("id", id)
    .single();
  if (!data) notFound();
  const patient = data as unknown as PatientRow;

  // By patient_id, not by the RUT-string grouping the history page falls back to.
  const { data: convData } = await supabase
    .from("conversations")
    .select("id, summary, status, created_at, messages(role, content, created_at)")
    .eq("patient_id", id)
    .order("created_at", { ascending: false });
  const conversations = (convData ?? []) as unknown as ConversationRow[];

  const synced = patient.record_source === "his";

  return (
    <div className="flex flex-1 flex-col">
      <Nav />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 p-4">
        <Link href="/dashboard/patients" className="text-sm text-zinc-500 hover:underline">
          ← Pacientes
        </Link>

        <section className="rounded-2xl border border-black/10 bg-white p-4 dark:border-white/15 dark:bg-zinc-900">
          <h1 className="text-lg font-semibold">{patient.name}</h1>
          <p className="text-sm text-zinc-500">{patient.rut}</p>
          <div className="mt-4">
            <PatientLink token={patient.token} />
          </div>
        </section>

        <section className="rounded-2xl border border-black/10 bg-white p-4 dark:border-white/15 dark:bg-zinc-900">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">Ficha de seguimiento</h2>
            {/* The badge is the integration seam made visible: today always "manual", and it flips
                when a hospital's ficha clínica system feeds the record. */}
            <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              {synced
                ? `⟳ sincronizada desde el sistema del hospital${
                    patient.record_synced_at
                      ? ` · ${new Date(patient.record_synced_at).toLocaleString("es-CL")}`
                      : ""
                  }`
                : "✎ ingresada por enfermera"}
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Datos operativos que la familia ve en el chat y que el asistente entrega textualmente.
            No reemplaza la ficha clínica del hospital.
          </p>
          {/* medications is untyped jsonb; normalise it before it reaches the form inputs. */}
          <RecordForm
            patientId={patient.id}
            record={{ ...patient, medications: parseMedications(patient.medications) }}
          />
        </section>

        <section className="space-y-2">
          <h2 className="px-1 text-sm font-medium text-zinc-500">
            Consultas ({conversations.length})
          </h2>
          {conversations.length === 0 && (
            <p className="px-1 text-sm text-zinc-500">Aún no hay consultas.</p>
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
                <div className="flex items-baseline justify-between gap-3 text-xs text-zinc-500">
                  <span>{STATUS_LABEL[c.status] ?? c.status}</span>
                  <span>{new Date(c.created_at).toLocaleString("es-CL")}</span>
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
                        <span className="font-medium">{(ROLE_LABEL[m.role] ?? m.role) + ": "}</span>
                        <span className="whitespace-pre-wrap">{m.content}</span>
                      </p>
                    ))}
                  </div>
                </details>
              </article>
            );
          })}
        </section>
      </main>
    </div>
  );
}
