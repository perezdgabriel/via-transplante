import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requireTenant } from "@/lib/tenant-server";

// Authenticated Supabase client for the nurse dashboard (reads the session from cookies).
// Resuelve el proyecto Supabase del hospital desde el Host: cada tenant tiene el suyo. Las cookies de
// sesión ya quedan aisladas solas — Supabase las nombra sb-<projectref>-auth-token y el subdominio
// acota el scope por host, así que la sesión de un hospital no es presentable en otro.
export async function createClient() {
  const tenant = await requireTenant();
  const cookieStore = await cookies();
  return createServerClient(tenant.supabaseUrl, tenant.anonKey, {
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
  });
}
