# Vía Transplante

Plataforma web de asistencia para una **Unidad de Trasplante Hepático y Renal Pediátrico**. Un asistente
con IA (API de Claude) atiende por chat las dudas de padres y cuidadores, resuelve lo sencillo y seguro,
entrega folletos, genera un certificado de asistencia para el colegio, y **escala a una enfermera** los
casos que lo requieren. La enfermera gestiona los avisos desde un dashboard y puede responder por el
mismo chat.

> Proyecto desarrollado para el **Claude Impact Lab 2026**.

## Qué hace

**Chat del paciente (link público, sin login):**
- Responde solo con **contenido aprobado por el hospital, de forma textual** — horarios, ubicaciones,
  requisitos, preparación de exámenes, cuidados post-trasplante. Nunca redacta indicaciones clínicas por
  su cuenta; lo que no está cubierto se escala.
- **Prioriza la seguridad:** una lista de señales de alarma (ej. fiebre ≥ 38 °C en un niño
  inmunosuprimido) anula la base de conocimiento y fuerza el escalamiento urgente.
- **Entrega folletos** educativos del catálogo (`entregar_folleto`).
- **Genera el certificado de asistencia** para el colegio (solo nombre, RUT y fecha; sin datos
  sensibles).
- **Escala a la enfermera** creando un aviso con prioridad propuesta (Urgente / Normal / Informativo) y
  un resumen del caso.

**Dashboard de la enfermera (autenticado):**
- Bandeja común de avisos activos con nombre/RUT, resumen, texto completo y prioridad.
- La enfermera reclasifica la prioridad, responde al paciente por el chat (en vivo, vía Realtime) o
  resuelve el aviso por fuera.
- Historial de todas las consultas, agrupadas por RUT.

El alcance clínico de la IA (relato textual de contenido aprobado + anulación por señales de alarma) está
documentado en [`docs/adr/0004-ai-clinical-scope-verbatim-kb.md`](docs/adr/0004-ai-clinical-scope-verbatim-kb.md).

## Stack

- **Next.js** (App Router) — chat y dashboard, ambos responsive.
- **Supabase** — Postgres, Auth (cuenta de enfermera + sesión anónima del paciente para Realtime) y RLS.
- **API de Claude** (Messages API) — el asistente, con herramientas (`escalate`, `generate_certificate`,
  `entregar_folleto`) y prompt caching en el system prompt.

El **código usa identificadores en inglés**; la **UI y la documentación, términos en español**. El
glosario del dominio está en [`CONTEXT.md`](CONTEXT.md).

## Puesta en marcha

Requisitos: Node 24+, pnpm, un proyecto de Supabase y una API key de Claude.

```bash
pnpm install
cp .env.example .env.local   # y completar los valores
pnpm dev
```

- Chat público: <http://localhost:3000>
- Dashboard enfermera: <http://localhost:3000/dashboard>

Variables de entorno (ver `.env.example`): `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (haiku en desarrollo,
`claude-sonnet-5` en producción), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y
`SUPABASE_SERVICE_ROLE_KEY` (solo servidor, nunca al navegador).

Los pasos completos (migraciones, cuenta de la enfermera, inicio de sesión anónimo) están en
[`docs/setup.md`](docs/setup.md).

## Estado

MVP. **El contenido clínico de la base de conocimiento es de demostración y aún no está validado por el
equipo clínico** — ver los avisos `PENDIENTE de firma clínica` en [`lib/knowledge-base.ts`](lib/knowledge-base.ts).
Antes de producción hay que reemplazarlo por contenido real firmado y revisar el cumplimiento de la
Ley 19.628 y la normativa de datos de salud en Chile.
