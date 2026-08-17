"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/app/TenantContext";

// Subscribes to alert changes and re-renders the server component (which refetches with auth).
// ponytail: refresh-on-any-event beats maintaining a client copy of the inbox.
export function AlertsRealtime() {
  const router = useRouter();
  const tenant = useTenant();
  // undefined until mounted, so SSR and first client render both emit nothing (no hydration mismatch).
  const [permission, setPermission] = useState<NotificationPermission>();

  useEffect(() => {
    setPermission(
      typeof Notification !== "undefined" ? Notification.permission : "denied",
    );

    const supabase = createClient(tenant.supabaseUrl, tenant.anonKey);
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    // alerts RLS (staff-only) is enforced on Realtime too, so the socket must carry the
    // nurse's JWT before subscribing — otherwise Postgres silently drops every event and
    // avisos only appear on a manual (cookie-authed) refresh.
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return; // StrictMode double-mount: effect already cleaned up.
      supabase.realtime.setAuth(data.session?.access_token);

      const channel = supabase
        .channel("alerts-inbox")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "alerts" },
          (payload) => {
            router.refresh();
            const row = payload.new as { priority?: string } | null;
            if (
              payload.eventType === "INSERT" &&
              row?.priority === "urgent" &&
              typeof Notification !== "undefined" &&
              Notification.permission === "granted"
            ) {
              // ponytail: no tag — a tag makes Chrome/macOS silently replace the prior
              // notification instead of showing a new banner. One banner per urgent aviso.
              new Notification("Aviso urgente", {
                body: "Ingresó un nuevo aviso urgente al panel de enfermería.",
              });
            }
          },
        )
        .subscribe();

      // Rebind only on the ~hourly token refresh. Re-calling setAuth on the initial
      // session event would reconnect the socket and drop the channel we just subscribed.
      const { subscription } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === "TOKEN_REFRESHED") supabase.realtime.setAuth(session?.access_token);
      }).data;

      cleanup = () => {
        subscription.unsubscribe();
        supabase.removeChannel(channel);
      };
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [router, tenant.supabaseUrl, tenant.anonKey]);

  if (!permission || permission === "granted") return null;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-4">
      <button
        onClick={() => Notification.requestPermission().then(setPermission)}
        disabled={permission === "denied"}
        className="rounded-lg border border-black/15 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-white/20"
      >
        {permission === "denied"
          ? "Notificaciones bloqueadas por el navegador"
          : "Activar notificaciones de avisos urgentes"}
      </button>
    </div>
  );
}
