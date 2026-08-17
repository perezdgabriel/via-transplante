import { createClient } from "@supabase/supabase-js";
import type { Tenant } from "@/lib/tenants";

// Service-role client for anonymous chat-side writes. SERVER ONLY — never import into client code.
// Apunta al proyecto Supabase DEL TENANT: los datos de paciente no comparten base entre hospitales
// (ver docs/adr/0008-dos-planos-de-tenancy.md). El tenant es un parámetro obligatorio a propósito —
// sin valor por defecto, para que no exista forma de abrir "la base equivocada" por omisión.
export function createServiceClient(tenant: Tenant) {
  return createClient(tenant.supabaseUrl, tenant.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
