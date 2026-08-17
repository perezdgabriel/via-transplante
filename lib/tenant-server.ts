import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getTenant, type Tenant } from "@/lib/tenants";

// Resolución del tenant para Server Components y Server Actions. Vive aparte de lib/tenants.ts porque
// ese módulo lo importa también el proxy (edge runtime), donde next/headers no existe.
//
// El proxy ya devolvió 404 para hosts desconocidos antes de llegar acá; esto es la segunda cerradura.
// Vale la pena tenerla: si alguien cambia el matcher del proxy, el modo de falla no puede ser "sirve
// los datos de otro hospital", tiene que ser "no sirve nada".
export async function requireTenant(): Promise<Tenant> {
  const tenant = getTenant((await headers()).get("host"));
  if (!tenant) notFound();
  return tenant;
}
