// Run: node lib/tenants.test.ts  (Node 24 strips TS types natively)
//
// Resolver el tenant NO es enrutamiento cosmético: con una base de datos por hospital, un host mal
// resuelto no muestra el logo equivocado, abre la base equivocada. Ver docs/adr/0008-dos-planos-de-tenancy.md.
//
// TENANTS_JSON se lee una sola vez y queda cacheado, así que este archivo usa una única configuración.
import assert from "node:assert";

process.env.TENANTS_JSON = JSON.stringify({
  hospital_a: {
    hospitalName: "Hospital A",
    unitName: "Unidad de Trasplante Hepático y Renal Pediátrico",
    packageId: "trasplante_pediatrico",
    supabaseUrl: "https://a.supabase.co",
    anonKey: "anon-a",
    serviceKey: "service-a",
  },
  hospital_b: {
    hospitalName: "Hospital B",
    unitName: "Unidad de Trasplante Hepático y Renal Pediátrico",
    packageId: "trasplante_pediatrico",
    supabaseUrl: "https://b.supabase.co",
    anonKey: "anon-b",
    serviceKey: "service-b",
  },
});
process.env.TENANT_FALLBACK_SLUG = "hospital_a";
process.env.APP_DOMAIN = "viatransplante.cl";

const { getTenant, publicTenant } = await import("./tenants.ts");

// Resuelve por subdominio, y cada hospital apunta a SU proyecto.
assert.equal(getTenant("hospital_a.viatransplante.cl")?.supabaseUrl, "https://a.supabase.co");
assert.equal(getTenant("hospital_b.viatransplante.cl")?.supabaseUrl, "https://b.supabase.co");

// Tolerante en la forma del host: puerto y mayúsculas no cambian a qué hospital se entra.
assert.equal(getTenant("Hospital_A.viatransplante.cl:3000")?.slug, "hospital_a");

// Host desconocido => null, y quien llama responde 404. NUNCA un tenant por defecto: caer a uno es
// exactamente cómo se termina sirviendo la base de datos de otro hospital.
assert.equal(getTenant("desconocido.viatransplante.cl"), null);
assert.equal(getTenant("viatransplante.cl"), null);
assert.equal(getTenant(""), null);
assert.equal(getTenant(null), null);

// EL CASO QUE IMPORTA: el slug correcto bajo un dominio AJENO no resuelve. Si resolviera, cualquiera
// que apunte hospital_a.attacker.com al origen tendría un clon funcional de ese hospital, con las
// cookies de sesión bajo su dominio y el login real servido para phishing.
assert.equal(getTenant("hospital_a.evil.cl"), null);
assert.equal(getTenant("hospital_a.attacker.com"), null);
assert.equal(getTenant("hospital_a.viatransplante.cl.evil.cl"), null);
// Ni un sufijo que solo "termina parecido".
assert.equal(getTenant("hospital_a.malviatransplante.cl"), null);
// Ni etiquetas de más: a.b.viatransplante.cl no es el tenant "b".
assert.equal(getTenant("x.hospital_a.viatransplante.cl"), null);

// El fallback de desarrollo existe solo para localhost, que no tiene subdominio...
assert.equal(getTenant("localhost:3000")?.slug, "hospital_a");
assert.equal(getTenant("hospital_b.localhost:3000")?.slug, "hospital_b");
// ...y un host real no puede activarlo, aunque la variable esté puesta por error en producción.
assert.equal(getTenant("www.viatransplante.cl"), null);
assert.equal(getTenant("evil.cl"), null);

// La service key nunca cruza al navegador.
const publico = publicTenant(getTenant("hospital_a.viatransplante.cl")!);
assert.ok(!("serviceKey" in publico), "publicTenant no debe exponer la service key");
assert.ok(!JSON.stringify(publico).includes("service-a"));
assert.equal(publico.anonKey, "anon-a");

console.log("tenants.test.ts OK");
