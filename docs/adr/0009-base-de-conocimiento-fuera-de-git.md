# La base de conocimiento sale de git: composición add-only y versiones firmadas

## Status

accepted (enmienda [0004](0004-ai-clinical-scope-verbatim-kb.md))

## Contexto y decisión

`0004` decidió que la base de conocimiento viviera en `lib/knowledge-base.ts`, y dejó anotada la
consecuencia: *"Editar el contenido aprobado requiere un deploy (es código). Mover a edición por
enfermera queda como evolución futura si el ritmo de cambios lo justifica."* Vender a hospitales lo
justifica: cada institución tiene sus horarios, sus ubicaciones y sus protocolos, y el contenido actual
está escrito para una sola unidad.

Lo que hay que cuidar al hacerlo es que **el argumento de seguridad de 0004 era git**. "La IA solo
entrega texto que un clínico redactó y aprobó" era cierto porque cada palabra pasó por un pull request.
Sacar la base de conocimiento de git elimina esa propiedad; esta decisión existe para reponerla.

### 1. Tres bloques, tres reglas

El contenido de `0004` no era una sola cosa. Se separa según quién puede tocar qué:

| Bloque | Origen | El hospital puede |
|---|---|---|
| Señales de alarma | baseline del paquete, en git | **solo añadir** |
| Clínico (preparación de exámenes, cuidados) | baseline del paquete, en git | **solo añadir** |
| Operativo (horarios, ubicaciones, requisitos) | sin baseline | **todo suyo** |

*Add-only* en las señales de alarma es lo que hace tolerable el resto: un hospital solo puede provocar
**más** escalamiento, nunca menos. El costo de equivocarse es una bandeja saturada —una falla comercial—
en vez de un niño inmunosuprimido con fiebre que se queda en casa.

**La garantía es estructural, no una política.** `systemPrompt()` concatena baseline primero y añadidos
después; no existe parámetro, rama ni valor de entrada que omita una línea del baseline. La invariante
está cubierta en `lib/prompts.test.ts`, incluyendo el caso en que el hospital escribe texto que pretende
anular las señales de alarma.

**Lo operativo sale del baseline por completo.** `Visitas 16:00-19:00` y `4º piso, ala norte` eran los
datos de una unidad concreta; recitárselos a la familia de otro hospital es afirmar algo falso. Vacío se
comporta como la ficha en `0007`: la sección no se renderiza, el modelo no sabe que existe, y escala en
vez de inventar.

### 2. Versiones firmadas en lugar del pull request

`knowledge_versions` es *append-only*: no tiene política de `update` ni de `delete`. Publicar es
insertar una fila; volver atrás es publicar de nuevo una anterior, que queda registrada como un evento
más. Cada fila lleva `signed_by` —el profesional que aprueba, obligatorio— y `published_by`.

Publicar exige `app_metadata.can_publish_kb`, que solo se edita desde el panel de Supabase: nadie puede
otorgárselo a sí mismo desde la app. La enfermera que triage avisos a las 3am puede leer esta pantalla,
pero no cambiar lo que la IA le dice a todas las familias.

## Considered Options

- **Reemplazo total: el hospital sobrescribe cualquier bloque, señales incluidas** — descartado. Borrar
  "fiebre ≥ 38 °C" es una falla silenciosa: no hay síntoma visible hasta que alguien se queda en casa.
- **Solo el bloque operativo editable, todo lo clínico en git** — descartado: un hospital que no puede
  fijar sus propios umbrales dirá que el producto no calza con su protocolo.
- **Entradas estructuradas** (filas con sección, título, estado y firma por entrada) — descartado por
  ahora: la IA recibe un string concatenado igual, así que al volumen actual no compra nada.
- **Subir el manual del hospital en PDF con RAG** — descartado, y deroga 0004 de raíz: recuperar
  fragmentos rompe la garantía de relato textual, porque nadie firmó el fragmento que eligió el
  recuperador.
- **Edición directa en vivo, sin versiones ni firma** — descartado: convierte "revisado en un PR" en "un
  textarea a las 3am", sin atribución ni forma de volver atrás.

## Consequences

- **Publicar deja de requerir un deploy, y también deja de tener revisión en git.** La calidad del
  contenido pasa a depender del proceso del hospital, igual que ya pasaba con la ficha en `0007`. Lo que
  se conserva es la trazabilidad: quién aprobó qué y cuándo.
- **El prefijo cacheado del prompt deja de ser global** y pasa a ser por hospital. Sigue acertando en
  todo el tráfico de una institución, que es donde importa; publicar una versión lo invalida, y eso pasa
  poco.
- **El tamaño de la base de conocimiento ahora es una variable de costo.** Se inyecta entera en cada
  turno (sin RAG, por 0004), así que el dashboard avisa a los 30.000 caracteres y bloquea a los 48.000.
  Si un hospital necesita más, la decisión de RAG hay que reabrirla — y con ella la garantía de 0004.
- **Un hospital recién dado de alta no tiene contenido operativo**, así que la IA escala toda pregunta de
  horarios y ubicaciones. Es el modo de falla correcto, pero significa que publicar la información
  operativa es parte del onboarding, no un paso opcional.
- **`lib/knowledge-base.ts` pasa a ser un registro de paquetes por especialidad.** Hoy solo existe
  `trasplante_pediatrico`; el baseline clínico (pomelo con inmunosupresores, vacunas vivas) solo es
  válido para pacientes trasplantados, y servírselo a otra especialidad sería peligroso. Por eso
  `getPackage()` lanza ante un id desconocido en vez de degradar.
