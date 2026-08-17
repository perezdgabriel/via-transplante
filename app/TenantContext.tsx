"use client";

import { createContext, useContext } from "react";
import type { PublicTenant } from "@/lib/tenants";

// Lleva la configuración pública del hospital a los client components (URL + anon key de SU proyecto
// Supabase, y el nombre para mostrar). Existe porque NEXT_PUBLIC_* se inlinea en build y aquí el
// proyecto depende del host, que solo se conoce en runtime.
//
// Solo PublicTenant: la service key nunca entra en este árbol.
const TenantContext = createContext<PublicTenant | null>(null);

export function TenantProvider({
  tenant,
  children,
}: {
  tenant: PublicTenant;
  children: React.ReactNode;
}) {
  return <TenantContext.Provider value={tenant}>{children}</TenantContext.Provider>;
}

export function useTenant(): PublicTenant {
  const tenant = useContext(TenantContext);
  if (!tenant) throw new Error("useTenant fuera de TenantProvider");
  return tenant;
}
