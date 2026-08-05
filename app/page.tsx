"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { isValidRut } from "@/lib/rut";
import { createClient } from "@/lib/supabase/client";

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [rut, setRut] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function start(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 2) return setError("Ingresa tu nombre.");
    if (!isValidRut(rut)) return setError("El RUT no es válido.");

    setLoading(true);
    try {
      // Silent anonymous identity so the chat can use Realtime (RLS scopes by auth.uid()).
      // Reuse an existing session so the same device keeps one owner across conversations.
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) await supabase.auth.signInAnonymously();

      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, rut }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error");
      localStorage.setItem("lastConversation", data.token);
      router.push(`/c/${data.token}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar.");
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <form
        onSubmit={start}
        className="w-full max-w-sm rounded-2xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/15 dark:bg-zinc-900"
      >
        <h1 className="text-xl font-semibold">Vía Transplante</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Cuéntanos tu duda. Un asistente te ayudará y, si es necesario, una
          enfermera revisará tu caso.
        </p>

        <label className="mt-5 block text-sm font-medium">Nombre</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2 dark:border-white/20 dark:bg-zinc-800"
          placeholder="Nombre y apellido"
          autoComplete="name"
        />

        <label className="mt-4 block text-sm font-medium">RUT</label>
        <input
          value={rut}
          onChange={(e) => setRut(e.target.value)}
          className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2 dark:border-white/20 dark:bg-zinc-800"
          placeholder="12.345.678-5"
          inputMode="text"
        />

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-5 w-full rounded-lg bg-zinc-900 px-4 py-2.5 font-medium text-white disabled:opacity-60 dark:bg-white dark:text-zinc-900"
        >
          {loading ? "Iniciando…" : "Iniciar chat"}
        </button>
      </form>
    </main>
  );
}
