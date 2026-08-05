import { createBrowserClient } from "@supabase/ssr";

// Browser Supabase client — used by the dashboard to subscribe to Realtime alerts.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
