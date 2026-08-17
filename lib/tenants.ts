// Registro de hospitales (tenants). Un solo env `TENANTS_JSON` en vez de 3N variables sueltas.
//
// Cada hospital tiene su PROPIO proyecto Supabase: los datos de paciente (medicamentos, alergias, y los
// mensajes donde un padre describe los síntomas de su hijo) nunca comparten base entre instituciones.
// Ver docs/adr/0008-dos-planos-de-tenancy.md.
//
// Efecto colateral: la autenticación multi-tenant sale gratis. Cada hospital tiene su propio Supabase
// Auth, así que no hacen falta tablas de organizaciones, membresías ni invitaciones.
import { getPackage } from "./knowledge-base.ts";

export type Tenant = {
  slug: string;
  hospitalName: string;
  /** Va en la primera línea del system prompt y define el baseline que aplica. */
  unitName: string;
  packageId: string;
  supabaseUrl: string;
  anonKey: string;
  /** SOLO servidor. Nunca cruzar al navegador: ver publicTenant(). */
  serviceKey: string;
};

/** Lo que sí puede ver el navegador. La anon key es pública por diseño; la service key jamás. */
export type PublicTenant = Omit<Tenant, "serviceKey">;

// Allowlist explícita, no un rest que descarta serviceKey: si mañana se agrega otro secreto a Tenant,
// la versión con rest lo dejaría pasar al navegador solo, y esta obliga a decidirlo a mano.
export function publicTenant(t: Tenant): PublicTenant {
  return {
    slug: t.slug,
    hospitalName: t.hospitalName,
    unitName: t.unitName,
    packageId: t.packageId,
    supabaseUrl: t.supabaseUrl,
    anonKey: t.anonKey,
  };
}

const REQUIRED = ["hospitalName", "unitName", "packageId", "supabaseUrl", "anonKey", "serviceKey"];

function parse(): Record<string, Tenant> {
  const raw = process.env.TENANTS_JSON;
  if (!raw) throw new Error("Falta TENANTS_JSON");

  const parsed = JSON.parse(raw) as Record<string, Omit<Tenant, "slug">>;
  const out: Record<string, Tenant> = {};
  for (const [slug, cfg] of Object.entries(parsed)) {
    for (const key of REQUIRED) {
      if (!cfg[key as keyof typeof cfg]) throw new Error(`TENANTS_JSON: falta ${key} en "${slug}"`);
    }
    // Un packageId con typo serviría el baseline de otra especialidad, o ninguno, así que se valida
    // acá y no en el primer mensaje de una familia.
    getPackage(cfg.packageId);
    out[slug] = { slug, ...cfg };
  }
  return out;
}

// OJO: parse() corre en el primer request, no al arrancar — Next no ejecuta este módulo en el build.
// Un TENANTS_JSON ausente o mal formado deja pasar el `next build` y después responde 500 en el 100%
// del tráfico, login incluido. Verificar la configuración es parte del despliegue, no algo que el
// arranque avise.
let cache: Record<string, Tenant> | null = null;
function all(): Record<string, Tenant> {
  if (!cache) cache = parse();
  return cache;
}

// Dominio propio de la app. Sin esto no se puede distinguir `calvomackenna.viatransplante.cl` de
// `calvomackenna.attacker.com`, así que su ausencia tiene que impedir resolver, no degradar.
function appDomain(): string {
  const domain = process.env.APP_DOMAIN;
  if (!domain) throw new Error("Falta APP_DOMAIN");
  return domain.toLowerCase().replace(/^\.+/, "");
}

function isLocal(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname.endsWith(".localhost")
  );
}

/**
 * Resuelve el tenant desde el Host. Devuelve null en host desconocido — quien llama responde 404.
 *
 * El host tiene que ser EXACTAMENTE `<slug>.<APP_DOMAIN>`. No alcanza con mirar la primera etiqueta:
 * eso haría que `calvomackenna.attacker.com` sirviera el hospital Calvo Mackenna a quien apunte ese
 * dominio al origen, con las cookies de sesión de Supabase quedando bajo un dominio ajeno y el
 * `/dashboard/login` real disponible para phishing.
 *
 * NUNCA hay tenant por defecto en producción: un fallback silencioso es exactamente cómo se termina
 * sirviendo la base de datos equivocada. TENANT_FALLBACK_SLUG existe solo para desarrollo local y se
 * ignora en cualquier host que no sea localhost, así que un despliegue real no puede activarlo.
 */
export function getTenant(host: string | null): Tenant | null {
  if (!host) return null;
  const hostname = host.split(":")[0].toLowerCase();
  const tenants = all();

  if (isLocal(hostname)) {
    // <slug>.localhost, y si no, el fallback explícito de desarrollo.
    const label = hostname.endsWith(".localhost") ? hostname.slice(0, -".localhost".length) : "";
    if (label && tenants[label]) return tenants[label];
    const fallback = process.env.TENANT_FALLBACK_SLUG;
    return fallback ? (tenants[fallback] ?? null) : null;
  }

  const suffix = `.${appDomain()}`;
  if (!hostname.endsWith(suffix)) return null;
  const slug = hostname.slice(0, -suffix.length);
  // Exactamente una etiqueta: `a.b.viatransplante.cl` no resuelve el tenant `b`.
  if (!slug || slug.includes(".")) return null;
  return tenants[slug] ?? null;
}

export function getTenantBySlug(slug: string): Tenant | null {
  return all()[slug] ?? null;
}
