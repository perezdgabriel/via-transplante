import { createClient } from "@supabase/supabase-js";

// Service-role client for anonymous chat-side writes. SERVER ONLY — never import into client code.
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
