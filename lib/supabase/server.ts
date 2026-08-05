import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Authenticated Supabase client for the nurse dashboard (reads the session from cookies).
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // Called from a Server Component render: safe to ignore (proxy refreshes the session).
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // ponytail: no-op in RSC context; the proxy handles cookie writes.
          }
        },
      },
    },
  );
}
