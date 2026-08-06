// Entry is nurse-provisioned (see docs/adr/0006): there is no self-serve form. Families re-enter
// through the link the nurse gave them at discharge (/p/<token>); the bare root just explains that.
export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-black/10 bg-white p-6 text-center shadow-sm dark:border-white/15 dark:bg-zinc-900">
        <h1 className="text-xl font-semibold">Vía Transplante</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Para usar el chat, abre el enlace que te entregó la enfermera de la
          unidad al momento del alta. Si no lo tienes, pídeselo al equipo.
        </p>
      </div>
    </main>
  );
}
