import { createClient } from "@/lib/supabase/server";
import { Nav } from "../Nav";
import { registerPatient } from "../actions";
import { PatientLink } from "./PatientLink";

export const dynamic = "force-dynamic";

type Patient = {
  id: string;
  token: string;
  name: string;
  rut: string;
  created_at: string;
};

export default async function PatientsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("patients")
    .select("id, token, name, rut, created_at")
    .order("created_at", { ascending: false });
  const patients = (data ?? []) as Patient[];

  return (
    <div className="flex flex-1 flex-col">
      <Nav />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 p-4">
        <section className="rounded-2xl border border-black/10 bg-white p-4 dark:border-white/15 dark:bg-zinc-900">
          <h1 className="text-lg font-semibold">Registrar paciente</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Registra al paciente (el niño/a) al alta y entrégale el enlace: es su
            acceso al chat, ya asociado a su nombre.
          </p>
          <form action={registerPatient} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex-1 text-sm">
              <span className="block font-medium">Nombre del paciente</span>
              <input
                name="name"
                required
                className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2 dark:border-white/20 dark:bg-zinc-800"
                placeholder="Nombre y apellido del niño/a"
              />
            </label>
            <label className="text-sm">
              <span className="block font-medium">RUT</span>
              <input
                name="rut"
                required
                className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2 dark:border-white/20 dark:bg-zinc-800"
                placeholder="12.345.678-5"
              />
            </label>
            <button className="rounded-lg bg-zinc-900 px-4 py-2 font-medium text-white dark:bg-white dark:text-zinc-900">
              Registrar
            </button>
          </form>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-medium text-zinc-500">
            Pacientes registrados ({patients.length})
          </h2>
          {patients.length === 0 && (
            <p className="text-sm text-zinc-500">Aún no hay pacientes.</p>
          )}
          {patients.map((p) => (
            <article
              key={p.id}
              className="rounded-2xl border border-black/10 bg-white p-4 dark:border-white/15 dark:bg-zinc-900"
            >
              <div className="mb-3">
                <p className="font-medium">{p.name}</p>
                <p className="text-sm text-zinc-500">{p.rut}</p>
              </div>
              <PatientLink token={p.token} />
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
