# Puesta en marcha — MVP Vía Transplante (Slice 1)

## Requisitos
- Node 24+, pnpm
- **Un proyecto de Supabase por hospital** (los datos de paciente no comparten base entre
  instituciones — ver `docs/adr/0008-dos-planos-de-tenancy.md`)
- Una API key de Claude (Anthropic)

## Pasos

1. **Instalar dependencias**
   ```bash
   pnpm install
   ```

2. **Variables de entorno**: copiar `.env.example` a `.env.local` y completar:
   - `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (haiku en desarrollo, `claude-sonnet-5` en producción)
   - `APP_DOMAIN`: el dominio propio de la app (`viatransplante.cl`). El host tiene que ser
     exactamente `<slug>.<APP_DOMAIN>`; sin esta variable no se puede distinguir
     `calvomackenna.viatransplante.cl` de `calvomackenna.attacker.com`.
   - `TENANTS_JSON`: un objeto con **una entrada por hospital**, donde la clave es el subdominio
     (`calvomackenna` → `calvomackenna.viatransplante.cl`). Cada entrada lleva `hospitalName`,
     `unitName`, `packageId`, `supabaseUrl`, `anonKey` y `serviceKey`. Si falta o está mal formado, la
     app compila igual y responde **500 en todas las rutas**, así que conviene verificarlo en el
     despliegue y no esperar a que avise el arranque.
   - `TENANT_FALLBACK_SLUG`: solo para desarrollo local, donde no hay subdominio. Se ignora en cualquier
     host que no sea `localhost`, así que no puede activarse por accidente en producción.

3. **Base de datos**: ejecutar las migraciones de `supabase/migrations/` en orden, **en el proyecto de
   cada hospital** (SQL Editor del panel, o `supabase db push` si usas la CLI).

   Opcional, solo para demos: ejecutar además `supabase/seed.sql`, que crea pacientes ficticios con su
   ficha de seguimiento, algunas consultas y un aviso activo, para que el dashboard no esté vacío. Es
   idempotente (se puede volver a correr). **No ejecutar en producción.**

4. **Cuenta de la enfermera**: en el panel de Supabase → Authentication → Users → crear un usuario
   (email + contraseña). Es la cuenta única compartida para el dashboard de ese hospital.

5. **Cuenta que publica la base de conocimiento**: crear un segundo usuario y, en su
   *App Metadata* (panel → Authentication → Users → el usuario → Raw App Meta Data), agregar:
   ```json
   { "can_publish_kb": true }
   ```
   Es el gate que reemplaza al pull request (ver `docs/adr/0009-base-de-conocimiento-fuera-de-git.md`).
   Va en `app_metadata` a propósito: el usuario no lo puede editar desde la app, solo un administrador
   desde el panel. Sin este flag la pantalla se ve, pero el botón de publicar no funciona.

6. **Inicio de sesión anónimo**: en Supabase → Authentication → Sign In / Providers → habilitar
   *Anonymous Sign-Ins*. El chat crea una sesión anónima silenciosa por paciente para el Realtime.
   Los usuarios anónimos se acumulan en `auth.users` (~1 por dispositivo); conviene limpieza periódica
   y protección del endpoint (CAPTCHA / rate limit). Ver `docs/adr/0003-anonymous-signin-for-realtime.md`.

7. **Publicar la información operativa**: en el dashboard → *Base de conocimiento*, completar horarios,
   ubicaciones y requisitos del hospital, firmar y publicar. **No es opcional**: sin contenido operativo
   publicado, la IA deriva a la enfermera toda pregunta de horarios o ubicaciones (que es el modo de
   falla correcto, pero deja al asistente casi mudo en las consultas más frecuentes).

8. **Levantar el proyecto**
   ```bash
   pnpm dev
   ```
   - Chat público: <http://localhost:3000>
   - Dashboard enfermera: <http://localhost:3000/dashboard>

   Para probar varios hospitales en local, los navegadores resuelven `*.localhost` a 127.0.0.1:
   <http://calvomackenna.localhost:3000> toma el tenant `calvomackenna` de `TENANTS_JSON`.

## Alcance
Chat público → Claude responde, escala, o **genera el certificado de asistencia** (PDF descargable,
solo nombre + RUT + fecha) → aviso en la bandeja de la enfermera → la enfermera reclasifica prioridad,
**responde al usuario por el mismo chat**, o resuelve. Tras escalar, la IA queda en silencio y el chat
del usuario se actualiza solo (~5s) para mostrar las respuestas de la enfermera; al resolver el aviso,
la conversación se cierra.
