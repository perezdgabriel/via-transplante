import { createClient } from "@/lib/supabase/server";
import { Nav } from "../Nav";
import { KnowledgeForm, type Version } from "./KnowledgeForm";
import { requireTenant } from "@/lib/tenant-server";
import { OPERATIONAL_TEMPLATE, getPackage } from "@/lib/knowledge-base";

export const dynamic = "force-dynamic";

export default async function KnowledgePage() {
  const tenant = await requireTenant();
  const pkg = getPackage(tenant.packageId);
  const supabase = await createClient();

  const { data } = await supabase
    .from("knowledge_versions")
    .select("id, operational, clinical_added, red_flags_added, signed_by, published_at")
    .order("published_at", { ascending: false })
    .limit(20);
  const versions = (data ?? []) as Version[];

  // El permiso vive en app_metadata, que solo se edita desde el panel de Supabase: un usuario no puede
  // otorgárselo a sí mismo. Esto es solo para la UI — quien manda es la política RLS del insert.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Se acepta el string "true" además del booleano para calzar con la política RLS, que hace
  // `->> 'can_publish_kb'` y por lo tanto coerce ambos. El flag se tipea a mano en el editor de JSON
  // del panel de Supabase, donde `"can_publish_kb": "true"` es un error fácil: si esta pantalla fuera
  // más estricta que la política, el botón quedaría deshabilitado mientras la base sí aceptaba el
  // insert — un ticket de soporte sin mensaje de error en ninguna parte.
  const flag = user?.app_metadata?.can_publish_kb;
  const canPublish = flag === true || flag === "true";

  return (
    <div className="flex flex-1 flex-col">
      <Nav />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 p-4">
        <section className="rounded-2xl border border-black/10 bg-white p-4 dark:border-white/15 dark:bg-zinc-900">
          <h1 className="text-lg font-semibold">Base de conocimiento</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Lo único que la IA puede afirmar a las familias de {tenant.hospitalName}. Lo entrega tal
            cual: no redacta ni completa. Todo lo que no esté aquí, lo deriva a la enfermera.
          </p>
          <KnowledgeForm
            versions={versions}
            pkg={pkg}
            canPublish={canPublish}
            operationalTemplate={OPERATIONAL_TEMPLATE}
          />
        </section>
      </main>
    </div>
  );
}
