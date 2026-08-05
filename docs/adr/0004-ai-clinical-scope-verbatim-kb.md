# Alcance clínico de la IA: relato textual de contenido aprobado con anulación por señales de alarma

## Status

accepted

## Contexto y decisión

La IA del chat atiende dudas de padres/cuidadores de niños. Ampliamos su base de conocimiento a
información operativa (horarios, ubicaciones, requisitos), preparación de exámenes (ayuno pediátrico),
cuidados leves post-atención (reacciones a vacunas, heridas/yesos, dieta) y entrega de folletos. Todo
esto es **orientación a cuidadores de niños posiblemente enfermos**, con riesgo clínico y legal
(Ley 19.628 y normativa de datos de salud).

Decidimos dos reglas que gobiernan el alcance clínico de la IA:

1. **Relato textual de contenido aprobado.** La IA solo entrega texto que un clínico del hospital
   redactó y aprobó, tal cual. La IA **nunca redacta indicaciones clínicas desde su propio
   conocimiento**. Lo que no está cubierto por el contenido aprobado se escala. La base de conocimiento
   vive en `lib/knowledge-base.ts` (versionada en git, auditable), y se inyecta completa en el system
   prompt en cada request (sin RAG ni base de datos: el volumen es bajo y el contenido chico).

2. **Anulación por señales de alarma.** Existe una lista de señales de alarma, también aprobada por el
   hospital, con precedencia sobre cualquier entrada de la base de conocimiento. El orden es:
   (a) hay señal de alarma → escalar (urgente), sin tranquilizar con el folleto;
   (b) el caso está totalmente cubierto y es claramente benigno → responder desde el contenido aprobado
   o entregar folleto; (c) cualquier otra cosa → escalar.

Para contenido por edad (ej. tabla de ayuno), las bandas se definen con límites numéricos inequívocos;
la IA pregunta la edad y calza la banda como una **búsqueda, no un juicio clínico**. Ante edad ambigua
o de borde, entrega ambas bandas o escala.

## Considered Options

- **La IA redacta indicaciones clínicas desde su conocimiento general** — descartado: pone al modelo a
  autorar consejo médico sobre niños enfermos (riesgo de alucinación y de responsabilidad legal), sin
  trazabilidad de quién aprobó cada indicación.
- **Dejar el juicio de gravedad al modelo, sin lista de señales de alarma** — descartado: el modo de
  falla es una emergencia no detectada. La lista explícita hace el disparo predecible y auditable.
- **RAG / tabla en Supabase para la base de conocimiento** — descartado por ahora: sobra para el volumen
  (~40 consultas/día) y agrega infraestructura. Un archivo versionado alcanza y es más fácil de auditar.

## Consequences

- Cada entrada clínica y cada señal de alarma **requiere aprobación de un clínico** antes de producción.
  El contenido en `lib/knowledge-base.ts` que no esté firmado es placeholder y no debe ir a producción.
- La cobertura es deliberadamente acotada: la IA escala más seguido de lo que "podría" responder. Es el
  trade-off aceptado (seguridad/trazabilidad sobre cobertura).
- Editar el contenido aprobado requiere un deploy (es código). Mover a edición por enfermera (tabla en
  Supabase) queda como evolución futura si el ritmo de cambios lo justifica.
- El system prompt sigue siendo la barrera de seguridad; ver `lib/prompts.ts`. Se relaciona con el
  certificado, que tampoco lo decide la IA por su cuenta.
