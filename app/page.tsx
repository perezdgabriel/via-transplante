"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isValidRut } from "@/lib/rut";
import { createClient } from "@/lib/supabase/client";

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [rut, setRut] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // true until the mount effect decides whether to auto-start or show the form (avoids a form flash).
  const [booting, setBooting] = useState(true);

  const startChat = useCallback(
    async (n: string, r: string) => {
      setError(null);
      if (n.trim().length < 2) return setError("Ingresa tu nombre.");
      if (!isValidRut(r)) return setError("El RUT no es válido.");

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
          body: JSON.stringify({ name: n, rut: r }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Error");
        localStorage.setItem("lastConversation", data.token);
        localStorage.setItem("patientName", n);
        localStorage.setItem("patientRut", r);
        router.push(`/c/${data.token}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo iniciar.");
        setLoading(false);
        setBooting(false); // auto-start failed → fall back to the form
      }
    },
    [router],
  );

  // On this device already? Skip the form and start a new chat straight away. Otherwise prefill
  // + show the form. Runs in an effect (not useState init) to keep localStorage off the SSR path.
  useEffect(() => {
    const savedName = localStorage.getItem("patientName") ?? "";
    const savedRut = localStorage.getItem("patientRut") ?? "";
    setName(savedName);
    setRut(savedRut);
    if (savedName.trim().length >= 2 && isValidRut(savedRut)) {
      startChat(savedName, savedRut);
    } else {
      setBooting(false);
    }
  }, [startChat]);

  function startAsSomeoneElse() {
    localStorage.removeItem("patientName");
    localStorage.removeItem("patientRut");
    setName("");
    setRut("");
    setError(null);
    setLoading(false);
    setBooting(false);
  }

  // Auto-starting (or its brief failure window): show a minimal screen, not the empty form.
  if (booting) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-3 p-4 text-center">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Iniciando tu chat…</p>
        <button
          onClick={startAsSomeoneElse}
          className="text-sm font-medium text-zinc-900 underline dark:text-white"
        >
          Iniciar como otra persona
        </button>
      </main>
    );
  }

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          startChat(name, rut);
        }}
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
