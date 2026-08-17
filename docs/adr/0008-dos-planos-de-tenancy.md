# Dos planos de tenancy: configuración compartida, datos de paciente aislados

## Status

accepted

## Contexto y decisión

Para vender a más de un hospital hay que volver la app multi-tenant. La decisión obvia —`org_id` en cada
tabla y una sola base— resulta equivocada acá, porque los dos tipos de dato que maneja la app tienen
perfiles de riesgo opuestos:

- **La base de conocimiento no es dato personal.** Horarios, ayuno pediátrico y señales de alarma no
  identifican a nadie. Compartir la infraestructura que la sirve no tiene exposición legal.
- **`patients` y `messages` sí son datos sensibles de salud, y de NNA.** No solo la ficha
  (`medications`, `allergies`): también `messages`, que es texto libre donde un padre describe los
  síntomas de su hijo. Es el dato más sensible del sistema y el menos controlado.

Decidimos **separar los planos**:

1. **Plano de configuración: compartido, y sin base de datos central.** El baseline clínico vive en
   `lib/knowledge-base.ts`, versionado en git. Como hay un solo despliegue, ya está compartido por
   construcción: no hace falta un proyecto Supabase de control para lograrlo, y evitarlo también evita
   un punto único de falla que tumbaría a todos los hospitales a la vez.
2. **Plano de datos: un proyecto Supabase por hospital.** `patients`, `conversations`, `messages` y
   `alerts` viven en la base del hospital. El registro de hospitales es un solo env, `TENANTS_JSON`,
   que mapea subdominio → credenciales.

## Considered Options

- **Multi-tenant clásico, `org_id` en cada tabla** — descartado. Cada política RLS de 0004/0006/0007
  está escrita como `(auth.jwt() ->> 'is_anonymous')::boolean = false`, es decir "cualquier miembro del
  staff ve todo". Bajo un `org_id` compartido, un solo predicado olvidado hace que la enfermera del
  hospital A lea los medicamentos de los niños del hospital B. Y con la Ley 21.719 vigente desde el 1 de
  diciembre de 2026, ese bug es una brecha notificable en 72 h a **todos** los hospitales vendidos, con
  multas de hasta 20.000 UTM. Aislar acota el radio de explosión a una institución.
- **Aislar también la configuración (un Supabase por hospital, sin baseline)** — descartado: cada
  hospital arrancaría con un textarea vacío en vez de heredar contenido clínico curado. El baseline
  *es* el producto; sin él esto es "un chat con un campo de texto".
- **Un Supabase central de control** — descartado por ahora. Habilitaría onboarding sin deploy, pero
  agrega una base más que operar y asegurar para no comprar nada hoy: dar de alta un hospital exige
  contrato de encargo, evaluación de impacto y provisionar su Supabase, y un deploy es la parte barata
  de ese proceso.

## Consequences

- **La autenticación multi-tenant sale gratis.** Cada hospital tiene su propio Supabase Auth, así que no
  hacen falta tablas de organizaciones, membresías ni invitaciones. `0002` (cuenta de enfermera única y
  compartida, creada a mano en el panel) sigue vigente **por hospital**.
- **Toda migración hay que correrla en N proyectos.** Es el costo real y recurrente de esta decisión.
- **`NEXT_PUBLIC_SUPABASE_*` deja de servir.** Next inlinea esas variables en build y ahora el proyecto
  Supabase depende del host, que solo se conoce en runtime. Los server components pasan URL y anon key
  a los client components vía `app/TenantContext.tsx`. La service key nunca entra en ese árbol
  (`publicTenant()` usa allowlist explícita, no un rest, para que un secreto nuevo no se cuele solo).
- **Un host mal resuelto abre la base equivocada, no muestra el logo equivocado.** Por eso el proxy
  responde 404 ante un host desconocido en vez de caer a un tenant por defecto, `requireTenant()` vuelve
  a verificar del lado del servidor, y `TENANT_FALLBACK_SLUG` se ignora fuera de localhost.
- **Consultas cruzadas entre hospitales son imposibles**, no difíciles: no hay conexión que las alcance.
  El precio es que tampoco hay métricas agregadas de producto sin construirlas aparte — y como
  encargados del tratamiento tampoco podríamos usar esos datos para nuestros fines sin autorización
  expresa de cada hospital.
- **Pendiente y bloqueante, sin relación con esta decisión:** Anthropic es subencargado desde el primer
  día. Cada ficha y cada mensaje cruza a una API en EE.UU. y necesita términos con retención cero,
  autorización expresa en cada contrato de encargo y un mecanismo de transferencia internacional.
