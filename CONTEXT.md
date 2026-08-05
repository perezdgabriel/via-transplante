# Glosario del dominio

Términos canónicos del proyecto. El **código usa los identificadores en inglés**; la **UI y la
documentación usan los términos en español**. Este archivo es solo un glosario: sin detalles de
implementación.

| Español (dominio / UI) | Código (inglés) | Definición |
|---|---|---|
| Conversación / consulta | `Conversation` | Una sesión de chat de un usuario. Tiene un `token` secreto para reingresar sin login. |
| Mensaje | `Message` | Un turno del chat. `role`: `user`, `assistant` (IA) o `nurse` (respuesta de enfermera, futuro). |
| Aviso | `Alert` | Derivación creada al escalar. Es el ítem que la enfermera ve en su bandeja. Uno por escalamiento. |
| Enfermera | `Nurse` | Usuaria autenticada del dashboard. Hoy hay una sola cuenta compartida. |
| Escalar | `escalate` | Acción de la IA de derivar el caso a una enfermera. Herramienta que expone la IA. |
| Prioridad | `priority` | `urgent` (Urgente), `normal` (Normal), `informative` (Informativo). La IA la propone; la enfermera la reclasifica. |
| Resumen | `summary` | Texto breve del caso que escribe la IA al escalar, para la enfermera. |
| Certificado del colegio | `SchoolCertificate` | Constancia de asistencia con solo nombre + RUT, sin diagnóstico. (Pendiente, Slice 2.) |
| RUT | `rut` | Identificador nacional chileno. Se valida el dígito verificador. |

## Estados

- **Conversación** (`conversation_status`): `ai_active` (la IA está atendiendo), `escalated` (derivada a
  enfermera), `resolved` (cerrada por la enfermera).
- **Aviso** (`alert_status`): `active` (en la bandeja), `resolved` (fuera de la bandeja).
