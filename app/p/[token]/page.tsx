"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Magic-link target. This token is bound to the patient (registered by the nurse), so there is no
// form: ensure an anonymous session (so the chat gets Realtime), resolve to a conversation, and go.
export default function PatientEntry({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) await supabase.auth.signInAnonymously();

        const res = await fetch(`/api/patient/${token}/enter`, { method: "POST" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Error");
        if (cancelled) return;
        // Remember the patient link for same-device auto-resume (landing page + "nueva consulta").
        localStorage.setItem("patientToken", token);
        localStorage.setItem("lastConversation", data.token);
        router.replace(`/c/${data.token}`);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "No se pudo abrir el chat.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, router]);

  return (
    <main className="flex flex-1 items-center justify-center p-4 text-center">
      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Abriendo tu chat…</p>
      )}
    </main>
  );
}
