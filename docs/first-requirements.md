Documento de Requisitos — MVP Plataforma de Asistencia Pediátrica
1. Contexto

Plataforma web independiente para un hospital pediátrico. Un asistente con IA (API de Claude) atiende dudas de padres/cuidadores por chat, resuelve lo sencillo y seguro, genera un certificado simple, y escala a una enfermera los casos que lo requieran. La enfermera gestiona los avisos desde un dashboard. Volumen estimado: ~40 consultas/día, 1 enfermera, operación 24-7. Ambas vistas responsive desde el día 1.

Stack: Next.js + Supabase + API de Claude. WhatsApp queda fuera del MVP (futuro canal).

2. Vista Usuario (Chat)

Acceso: link público sin login. Al iniciar, el usuario ingresa nombre y RUT (usados para identificarlo en avisos y en el certificado).

Capacidades del agente:

Responder dudas administrativas y clínicas solo si la respuesta es segura, según reglas definidas en el system prompt (ej: "¿puedo tomar este remedio sin ayuno?", "¿cuándo tengo control?").
Entregar folletos/infografías acordes a la duda.
Generar el certificado para el colegio (contiene solo nombre y RUT; sin diagnóstico ni dato sensible).
Dar indicaciones sencillas.
Escalar a enfermera creando un aviso cuando: no sepa qué hacer, detecte un caso grave, se requiera respuesta personalizada, o se pida algo que necesite la ficha del paciente (ej: dosis).
Al escalar, la IA propone una prioridad (Urgente / Normal / Informativo).
El certificado de citación NO lo genera el chat: se crea un aviso no urgente para que la enfermera lo emita manualmente.

Comportamiento al escalar: el usuario recibe un aviso de que una enfermera revisará su caso. La conversación se cierra si no requiere seguimiento, o se mantiene abierta para que la enfermera responda por el mismo canal.

Historial: se guardan todas las conversaciones (resueltas por IA y escaladas), con resumen del caso y texto completo.

3. Dashboard Enfermera
Bandeja común de avisos (no asignación individual).
Muestra avisos activos con: nombre/RUT del paciente, resumen del caso, texto completo, prioridad propuesta por la IA.
La enfermera puede reclasificar la prioridad.
Tres niveles: Urgente / Normal / Informativo.
Resolver un aviso: puede (a) responder al usuario por el chat, o (b) resolverlo por fuera (ej: llamada telefónica) y marcarlo como resuelto. Al resolver, el aviso deja de aparecer como activo. Se permite nota interna.
Consultar historial de todas las consultas.
Para ver la ficha del paciente, la enfermera usa el sistema interno del hospital por su cuenta (sin integración en el MVP): el aviso solo le entrega nombre/RUT.
4. Fuera del alcance del MVP
Canal WhatsApp (futuro).
Integración con ficha clínica / sistema interno.
Generación automática del certificado de citación (lo hace la enfermera).
Login/autenticación de usuarios del chat.
Asignación de avisos por enfermera y SLA.
5. Requisitos transversales
Responsive en chat y dashboard desde el día 1 (prioridad movilidad para enfermera).
Seguridad de respuestas: el system prompt debe contener la base de conocimiento y las reglas de qué NO responder y cuándo escalar. (Pendiente: refinarlo juntos.)
Privacidad: el certificado del colegio evita datos sensibles (solo nombre/RUT). Revisar cumplimiento de la Ley 19.628 y normativa de datos de salud en Chile antes de producción.
6. Puntos pendientes / riesgos a revisar
System prompt: refinar contenido y reglas de seguridad/escalamiento (trabajo conjunto).
Verificación de identidad: al ser link público sin login, cualquiera puede ingresar un RUT ajeno. Para el certificado del colegio el riesgo es bajo (solo nombre/RUT), pero conviene tenerlo consciente.
Persistencia del chat abierto: si la conversación queda abierta para respuesta de enfermera, el usuario debe poder volver a verla; definir cómo (¿link/código de sesión?).
Revisión legal de datos de salud antes de pasar de MVP a producción.