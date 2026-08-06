# Glosario del dominio

Términos canónicos del proyecto. El **código usa los identificadores en inglés**; la **UI y la
documentación usan los términos en español**. Este archivo es solo un glosario: sin detalles de
implementación.

| Español (dominio / UI) | Código (inglés) | Definición |
|---|---|---|
| Paciente | `Patient` | El niño/a en seguimiento post-trasplante. Lo registra la enfermera al alta (nombre + RUT). Tiene un `token` estable que vive en el **enlace** entregado a la familia. Es el sujeto del certificado. Una persona (a menudo el padre/madre) escribe *por* el paciente; a esa persona no se la identifica ni se la guarda. |
| Conversación / consulta | `Conversation` | Una sesión de chat de un paciente. Pertenece a un `Patient` y copia su nombre/RUT. Tiene un `token` secreto para reingresar sin login. Hay una sola consulta abierta por paciente a la vez. |
| Mensaje | `Message` | Un turno del chat. `role`: `user`, `assistant` (IA) o `nurse` (respuesta de enfermera, futuro). |
| Aviso | `Alert` | Derivación creada al escalar. Es el ítem que la enfermera ve en su bandeja. Uno por escalamiento. |
| Enfermera | `Nurse` | Usuaria autenticada del dashboard. Hoy hay una sola cuenta compartida. |
| Escalar | `escalate` | Acción de la IA de derivar el caso a una enfermera. Herramienta que expone la IA. |
| Prioridad | `priority` | `urgent` (Urgente), `normal` (Normal), `informative` (Informativo). La IA la propone; la enfermera la reclasifica. |
| Resumen | `summary` | Texto breve del caso que escribe la IA al escalar, para la enfermera. |
| Certificado del colegio | `SchoolCertificate` | Constancia de asistencia con solo nombre + RUT + fecha, sin diagnóstico. Se emite a nombre del **paciente** registrado. |
| RUT | `rut` | Identificador nacional chileno. Se valida el dígito verificador. Es un **organizador** (agrupa consultas por paciente), no una llave de acceso. Lo registra la enfermera, no la familia. |
| Enlace del paciente | `patients.token` | Secreto no adivinable que la enfermera entrega a la familia al alta (`/p/<token>`). Es la llave durable de acceso del paciente; abrirlo retoma la consulta abierta o inicia una nueva. |
| Dueño de la conversación | `owner_id` | Usuario anónimo de Supabase (`auth.uid()`) del dispositivo que abrió la consulta. Habilita el Realtime del paciente vía RLS; apunta al dispositivo activo actual. El **token** sigue siendo la llave de acceso. |
| Base de conocimiento | `knowledgeBase` | Contenido aprobado por el hospital que la IA puede entregar. La IA **solo relata texto aprobado de forma textual**; nunca redacta indicaciones clínicas por su cuenta. Lo no cubierto se escala. |
| Folleto | `Folleto` | Recurso educativo (PDF/infografía) del catálogo del hospital que la IA puede entregar al usuario. |

## Estados

- **Conversación** (`conversation_status`): `ai_active` (la IA está atendiendo), `escalated` (derivada a
  enfermera), `resolved` (cerrada por la enfermera).
- **Aviso** (`alert_status`): `active` (en la bandeja), `resolved` (fuera de la bandeja).
