"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Subscribes to alert changes and re-renders the server component (which refetches with auth).
// ponytail: refresh-on-any-event beats maintaining a client copy of the inbox.
export function AlertsRealtime() {
  const router = useRouter();
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("alerts-inbox")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "alerts" },
        () => router.refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);
  return null;
}
