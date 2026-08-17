-- Base de conocimiento editable por el hospital. Corre en el proyecto Supabase de CADA tenant.
-- See docs/adr/0009-base-de-conocimiento-fuera-de-git.md (enmienda 0004).
--
-- 0004 decidió que la BdC viviera en git, y su argumento de seguridad completo era que git ES el gate
-- de aprobación: "la IA solo relata texto que un clínico aprobó" era cierto porque cada palabra pasó
-- por un PR. Esta tabla es lo que reemplaza esa propiedad, no lo que la abandona:
--
--   * append-only  -> no hay política de update ni de delete. La bitácora de qué aprobó quién no se
--                     puede editar ni borrar. Rollback = insertar de nuevo una versión anterior, que
--                     queda registrada como un evento más.
--   * signed_by    -> el nombre del clínico que aprueba el contenido. Es el equivalente al autor del
--                     PR, y por eso es NOT NULL: publicar sin firma no es publicar.
--   * can_publish_kb -> la enfermera que triage avisos a las 3am no debe poder cambiar lo que la IA
--                     le dice a todas las familias. El flag va en app_metadata, que solo se edita
--                     desde el panel de Supabase (igual que la cuenta de enfermera de 0002), nunca
--                     desde la app: un usuario no puede otorgarse el permiso a sí mismo.
--
-- El campo `operational` NO tiene baseline en git a propósito: horarios y ubicaciones son distintos en
-- cada institución, y recitar los de otra es afirmar algo falso. Vacío => la IA escala (ver
-- lib/prompts.ts, sección `section()`).

create table knowledge_versions (
  id uuid primary key default gen_random_uuid(),
  -- §1: 100% del hospital, sin baseline.
  operational     text not null default '',
  -- Se AÑADEN al baseline del paquete clínico; nunca lo reemplazan (lib/prompts.ts).
  clinical_added  text not null default '',
  red_flags_added text not null default '',
  signed_by    text        not null check (length(btrim(signed_by)) > 0),
  published_by uuid        not null default auth.uid() references auth.users(id),
  published_at timestamptz not null default now()
);

-- La versión vigente es la última fila. Índice para el lookup que corre en cada turno del chat.
create index knowledge_versions_published_at_idx on knowledge_versions (published_at desc);

alter table knowledge_versions enable row level security;

-- Cualquier miembro del staff LEE (necesita ver la versión vigente para editarla y para el historial).
create policy "staff reads knowledge" on knowledge_versions for select to authenticated
  using ((auth.jwt() ->> 'is_anonymous')::boolean = false);

-- Pero solo quien tiene el flag PUBLICA. Es el gate que reemplaza al PR.
create policy "publishers insert knowledge" on knowledge_versions for insert to authenticated
  with check (
    (auth.jwt() ->> 'is_anonymous')::boolean = false
    and coalesce((auth.jwt() -> 'app_metadata' ->> 'can_publish_kb')::boolean, false)
  );

-- Sin policy de update ni de delete: append-only por ausencia, que es la forma más difícil de revertir
-- por accidente. Agregar una después es una decisión explícita que alguien tiene que escribir.
