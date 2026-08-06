# Enlaces de paciente generados por la enfermera (entrada provista, no self-serve)

## Status

accepted (amplía [0001](0001-tokenless-public-chat-reentry.md))

## Contexto y decisión

El chat capturaba la identidad en el formulario público (`app/page.tsx`): quien abría escribía **su
propio** nombre + RUT, que se guardaban como `conversations.patient_name`/`rut`. En la práctica esa
persona es el **padre/madre**, no el niño/a. Pero el certificado del colegio debe nombrar al
**estudiante**, así que la migración `0005` agregó `certificate_name`/`certificate_rut` y la herramienta
`generate_certificate` **volvía a preguntar** la identidad a mitad de chat. Resultado: la identidad se
capturaba dos veces, de dos personas distintas, y la primera captura era casi inútil.

Decidimos mover la captura de identidad **aguas arriba, a quien sí la conoce**: la enfermera, al alta.
La enfermera registra al **paciente** (una entidad nueva = el niño/a) una vez y entrega a la familia un
**enlace** (`/p/<token>`) ya asociado a ese paciente. El enlace es la llave durable del paciente; el
`token` de la conversación sigue siendo la credencial por-consulta. Abrir el enlace **retoma** la
consulta abierta (una por paciente) o **inicia** una nueva si la última fue resuelta. No hay formulario:
la familia solo abre el enlace.

## Considered Options

- **Mantener el self-serve y arreglar solo el formulario** (pedir la identidad del estudiante al inicio)
  — descartado: sigue pidiendo datos a quien puede no conocerlos con exactitud, y no aprovecha que la
  enfermera ya tiene la identidad verificada.
- **Enlace a una sola conversación** (token = un chat) — descartado: las consultas se cierran al
  resolverse y el seguimiento es longitudinal (muchas consultas por familia); un enlace de una sola
  conversación moriría tras la primera consulta resuelta.
- **Envío automático por SMS/WhatsApp** — descartado para el MVP: requiere captura de teléfono, un
  proveedor pago y manejo de fallos de entrega. La enfermera entrega el enlace a mano (copiar / QR).

## Consequences

- La identidad queda **verificada por la enfermera** al alta, lo que cierra el riesgo que 0001 dejaba
  abierto ("cualquiera podría ingresar un RUT ajeno").
- Desaparece la doble captura: `certificate_name`/`certificate_rut` (0005) se eliminan y el certificado
  se emite a nombre del paciente registrado; la herramienta `generate_certificate` ya no pide datos.
- Ya **no hay entrada self-serve**: quien no tiene enlace no puede iniciar un chat. Es aceptable porque
  el flujo real es "la enfermera entrega el enlace al alta"; la página `/` explica cómo obtenerlo.
- `conversations.patient_name`/`rut` pasan a ser una **copia denormalizada** del paciente al crear la
  conversación, para no tocar las consultas de chat/certificado/dashboard que ya los leen.
- El `owner_id` de la conversación se reapunta al dispositivo que abre el enlace, para que el Realtime
  del paciente funcione en el dispositivo activo; los demás dispositivos usan el poll de respaldo.
