# Ficha de seguimiento: relato textual de campos aprobados por paciente

## Status

accepted (amplía [0004](0004-ai-clinical-scope-verbatim-kb.md))

## Contexto y decisión

Hasta ahora la IA sabía **una sola cosa** del paciente: su nombre. Toda pregunta personalizada
("¿cuándo es el control?", "¿qué remedios toma?") caía en el escalamiento, porque
`docs/first-requirements.md` listaba "se pida algo que necesite la ficha del paciente" como
**criterio de escalamiento** y dejaba la integración con la ficha clínica **fuera del alcance del
MVP**. En la práctica eso convierte en aviso para la enfermera justamente las preguntas más
frecuentes y más fáciles de responder bien.

Agregamos una **ficha de seguimiento** por paciente con cuatro campos operativos —próximo control,
medicamentos (con dosis y frecuencia), alergias y restricciones— que la enfermera completa desde el
dashboard, y que la IA puede **leer tal cual**.

Esto **no deroga 0004, lo amplía**: la regla sigue siendo "la IA solo relata texto que un clínico
aprobó". Lo que cambia es que ahora ese texto aprobado puede ser **por paciente**, no solo global.
La IA sigue sin redactar indicaciones clínicas desde su propio conocimiento.

Tres reglas gobiernan el alcance:

1. **Lectura, nunca cálculo.** La IA entrega el campo tal cual. No ajusta dosis por peso ni por
   síntomas, no convierte unidades, no interpreta lo que le pasa al niño/a contrastándolo con la
   ficha. Cualquier pregunta que requiera eso se escala.

2. **Campo vacío = omitido del prompt.** Un campo sin valor **no se renderiza**: el modelo ni
   siquiera sabe que existe, así que no puede afirmar su ausencia. Que las alergias no estén
   registradas **no significa** que el niño/a no tenga alergias, y ese es el modo de falla más
   peligroso de esta función. Si no hay alergias conocidas, la enfermera lo escribe
   ("Ninguna conocida") y eso se relata textualmente. La ausencia de dato nunca se convierte en dato.

3. **Un campo cubre solo lo que dice.** Si "Restricciones: sin lácteos" y preguntan por mariscos, se
   escala; no se infiere permiso por omisión.

Las señales de alarma de 0004 mantienen precedencia sobre cualquier lectura de la ficha.

Decisiones de forma que acompañan lo anterior:

- **Se lee en vivo** desde `patients` vía `conversations.patient_id`, no se copia a la conversación
  como `patient_name`/`rut`. Una ficha desactualizada es exactamente el riesgo que se quiere evitar.
- **El próximo control es `timestamptz` y se omite si ya pasó.** El system prompt es estático a
  propósito (cacheable), así que el modelo no tiene noción de qué día es; se le inyecta la fecha de
  hoy en el bloque no cacheado, junto con la ficha.
- **La familia ve la ficha directamente** en una tarjeta del chat, además de poder preguntarla. La
  tarjeta y el prompt salen de la misma función (`recordFields`) **y del mismo reloj**: los campos se
  calculan en el servidor y se envían ya resueltos, así que el reloj del teléfono de la familia no
  puede hacer que la tarjeta muestre un control que la IA ya descartó por vencido. La tarjeta es el
  camino correcto por construcción; el chat es el cómodo.

## Considered Options

- **Que la IA razone sobre la ficha** (calcular dosis por peso, interpretar síntomas contra el
  historial) — descartado: es exactamente el modo que 0004 rechazó, ahora con datos del paciente
  concreto, que es peor. Un error deja de ser información general equivocada y pasa a ser un consejo
  personalizado equivocado, que el cuidador va a creer mucho más.
- **Solo tarjeta, IA ciega a la ficha** — descartado: elimina todo el riesgo nuevo, pero la IA
  seguiría escalando cada pregunta personalizada, que es justamente lo que se quería resolver.
- **Incluir diagnóstico y tipo de trasplante** — descartado: multiplica la sensibilidad del dato sin
  responder ninguna pregunta operativa del cuidador. Es también lo que separa esta ficha de una ficha
  clínica de verdad, y por eso el término elegido es "ficha de seguimiento" (ver `CONTEXT.md`).
- **Incluir peso/talla** — descartado: en una ficha de trasplante el peso existe casi exclusivamente
  para calcular dosis, que es lo único que la IA no debe hacer. Tenerlo en contexto es invitar al
  modelo al modo de falla que estas reglas previenen.
- **Campo `notas` de texto libre para la enfermera** — descartado: un bloque de prosa sin etiqueta no
  responde una pregunta concreta, así que el modelo tiene que decidir qué es relevante y parafrasear.
  Eso es composición, no lectura.
- **Una herramienta `consultar_ficha`** — descartado, y además hoy imposible: `app/api/chat/route.ts`
  toma el **primer** bloque `tool_use`, nunca devuelve un `tool_result` al modelo y nunca hace una
  segunda llamada. Inyectar en el bloque de system es más simple y es lo único que funciona.

## Consequences

- **Es la primera vez que esta app guarda datos de salud.** `0001_init.sql` comentaba la columna rut
  con "no diagnosis stored"; esa postura termina aquí. Aunque se excluyó el diagnóstico, medicamentos
  y alergias son datos de salud bajo la Ley 19.628. La revisión legal pendiente desde
  `docs/first-requirements.md` ahora es bloqueante para producción, no opcional.
- La ficha queda expuesta bajo el token de la conversación, con el mismo modelo de confianza que la
  transcripción completa (ver [0001](0001-tokenless-public-chat-reentry.md)). No es una exposición
  nueva de superficie, pero sí de tipo de dato.
- `patients` deja de ser write-once: 0006 solo otorgaba `select` + `insert`, y 0007 agrega política de
  `update`. La enfermera completa la ficha a lo largo del tiempo, no toda al alta.
- **Integración futura, de un solo sentido y de solo lectura.** El seam es una función,
  `getPatientRecord(rut) → PatientRecord | null`; hoy es una lectura de la base. La llave de unión con
  el sistema del hospital es el **RUT**, que ya se guarda y se valida (`lib/rut.ts`). Los cuatro campos
  calzan casi 1:1 con recursos FHIR (`Appointment`, `MedicationRequest.dosageInstruction`,
  `AllergyIntolerance`), lo que hace del adaptador un mapeo y no un rediseño. **Nunca se escribe hacia
  el sistema del hospital**: escritura implica otra categoría de revisión de seguridad y
  responsabilidad. La columna `record_source` existe para mostrar esa costura en pantalla
  ("ingresada por enfermera" / "sincronizada desde el sistema del hospital").
- El contenido de la ficha lo escribe la enfermera, no un archivo versionado: a diferencia de
  `lib/knowledge-base.ts`, **no hay revisión en git de lo que la IA va a relatar**. La calidad del
  dato depende del proceso del hospital, no del repositorio.
