import { createBrowserClient } from "@supabase/ssr";

// Browser Supabase client — Realtime del dashboard y sesión anónima del paciente.
//
// La URL y la anon key llegan por PARÁMETRO, no de process.env: NEXT_PUBLIC_* se inlinea en build y
// aquí el proyecto Supabase depende del hospital, que solo se conoce en runtime. Los server components
// las pasan por el TenantProvider (app/TenantContext.tsx). La anon key es pública por diseño; la
// service key nunca cruza al navegador (ver publicTenant() en lib/tenants.ts).
export function createClient(supabaseUrl: string, anonKey: string) {
  return createBrowserClient(supabaseUrl, anonKey);
}
