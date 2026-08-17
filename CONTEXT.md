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
| Enfermera | `Nurse` | Usuaria autenticada del dashboard. Hoy hay una sola cuenta compartida **por hospital**. |
| Publicadora | `can_publish_kb` | Cuenta autorizada a publicar la base de conocimiento. Es un permiso, no un cargo: se otorga desde el panel de Supabase y nadie puede otorgárselo a sí mismo. Una enfermera puede triar avisos sin poder cambiar lo que la IA le dice a todas las familias. |
| Escalar | `escalate` | Acción de la IA de derivar el caso a una enfermera. Herramienta que expone la IA. |
| Prioridad | `priority` | `urgent` (Urgente), `normal` (Normal), `informative` (Informativo). La IA la propone; la enfermera la reclasifica. |
| Resumen | `summary` | Texto breve del caso que escribe la IA al escalar, para la enfermera. |
| Certificado del colegio | `SchoolCertificate` | Constancia de asistencia con solo nombre + RUT + fecha, sin diagnóstico. Se emite a nombre del **paciente** registrado. |
| RUT | `rut` | Identificador nacional chileno. Se valida el dígito verificador. Es un **organizador** (agrupa consultas por paciente), no una llave de acceso. Lo registra la enfermera, no la familia. |
| Enlace del paciente | `patients.token` | Secreto no adivinable que la enfermera entrega a la familia al alta (`/p/<token>`). Es la llave durable de acceso del paciente; abrirlo retoma la consulta abierta o inicia una nueva. |
| Dueño de la conversación | `owner_id` | Usuario anónimo de Supabase (`auth.uid()`) del dispositivo que abrió la consulta. Habilita el Realtime del paciente vía RLS; apunta al dispositivo activo actual. El **token** sigue siendo la llave de acceso. |
| Ficha de seguimiento | `PatientRecord` | Subconjunto **operativo** del paciente que la IA puede leer **textualmente**: próximo control, medicamentos (con dosis y frecuencia), alergias y restricciones. Sin diagnóstico, sin tipo de trasplante, sin peso. **No es la ficha clínica del hospital**: no es el registro autoritativo ni pretende serlo. La enfermera la completa; a futuro puede venir del sistema del hospital. Un campo vacío significa *no registrado*, nunca *no tiene*. |
| Base de conocimiento | `knowledgeBase` | Todo el contenido aprobado que la IA puede entregar. La IA **solo relata texto aprobado de forma textual**; nunca redacta indicaciones clínicas por su cuenta. Lo no cubierto se escala. Se **compone** de un paquete clínico más el contenido del hospital. |
| Paquete clínico | `ClinicalPackage` | Contenido aprobado de una **especialidad** (hoy: trasplante pediátrico), versionado en git y compartido por todos los hospitales. Un hospital puede añadirle, **nunca quitarle**. |
| Contenido operativo | `operational` | Horarios, ubicaciones y requisitos. Es **del hospital y solo del hospital**: no tiene paquete clínico detrás, porque es distinto en cada institución. Vacío significa *no registrado* — la IA escala en vez de inventarlo. |
| Añadidos del hospital | `clinical_added`, `red_flags_added` | Contenido que un hospital **suma** a su paquete clínico. Solo suman: no hay forma de que quiten una línea del paquete. |
| Versión de la base de conocimiento | `KnowledgeVersion` | Una publicación: la base de conocimiento completa del hospital en un momento dado, con su firmante y su fecha. Es inmutable — volver atrás es publicar de nuevo, no editar. |
| Publicar | `publish` | Poner una versión en producción. Reemplaza al *pull request* como gate de aprobación del contenido. |
| Firmante | `signed_by` | Profesional que aprueba el contenido de una versión. Obligatorio: publicar sin firma no es publicar. |
| Hospital | `Tenant` | Institución cliente. Tiene su propio subdominio, su propia base de conocimiento y su **propia base de datos** de pacientes: los datos de paciente nunca se comparten entre hospitales. |
| Folleto | `Folleto` | Recurso educativo (PDF/infografía) del catálogo del hospital que la IA puede entregar al usuario. |

## Estados

- **Conversación** (`conversation_status`): `ai_active` (la IA está atendiendo), `escalated` (derivada a
  enfermera), `resolved` (cerrada por la enfermera).
- **Aviso** (`alert_status`): `active` (en la bandeja), `resolved` (fuera de la bandeja).
