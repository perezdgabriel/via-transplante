"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/app/TenantContext";

export default function LoginPage() {
  const router = useRouter();
  const tenant = useTenant();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient(tenant.supabaseUrl, tenant.anonKey);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError("Credenciales inválidas.");
      setLoading(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/15 dark:bg-zinc-900"
      >
        <h1 className="text-xl font-semibold">Dashboard Enfermería</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Ingresa para ver los avisos.</p>

        <label className="mt-5 block text-sm font-medium">Correo</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2 dark:border-white/20 dark:bg-zinc-800"
          autoComplete="username"
        />

        <label className="mt-4 block text-sm font-medium">Contraseña</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2 dark:border-white/20 dark:bg-zinc-800"
          autoComplete="current-password"
        />

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-5 w-full rounded-lg bg-zinc-900 px-4 py-2.5 font-medium text-white disabled:opacity-60 dark:bg-white dark:text-zinc-900"
        >
          {loading ? "Ingresando…" : "Ingresar"}
        </button>
      </form>
    </main>
  );
}
