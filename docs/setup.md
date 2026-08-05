# Puesta en marcha — MVP Asistencia Pediátrica (Slice 1)

## Requisitos
- Node 24+, pnpm
- Un proyecto de Supabase
- Una API key de Claude (Anthropic)

## Pasos

1. **Instalar dependencias**
   ```bash
   pnpm install
   ```

2. **Variables de entorno**: copiar `.env.example` a `.env.local` y completar:
   - `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (haiku en desarrollo, `claude-sonnet-5` en producción)
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (solo servidor)

3. **Base de datos**: ejecutar las migraciones de `supabase/migrations/` en orden en el proyecto de
   Supabase (SQL Editor del panel, o `supabase db push` si usas la CLI).

4. **Cuenta de la enfermera**: en el panel de Supabase → Authentication → Users → crear un usuario
   (email + contraseña). Es la cuenta única compartida para el dashboard.

5. **Inicio de sesión anónimo**: en Supabase → Authentication → Sign In / Providers → habilitar
   *Anonymous Sign-Ins*. El chat crea una sesión anónima silenciosa por paciente para el Realtime.
   Los usuarios anónimos se acumulan en `auth.users` (~1 por dispositivo); conviene limpieza periódica
   y protección del endpoint (CAPTCHA / rate limit). Ver `docs/adr/0003-anonymous-signin-for-realtime.md`.

6. **Levantar el proyecto**
   ```bash
   pnpm dev
   ```
   - Chat público: <http://localhost:3000>
   - Dashboard enfermera: <http://localhost:3000/dashboard>

## Alcance
Chat público → Claude responde, escala, o **genera el certificado de asistencia** (PDF descargable,
solo nombre + RUT + fecha) → aviso en la bandeja de la enfermera → la enfermera reclasifica prioridad,
**responde al usuario por el mismo chat**, o resuelve. Tras escalar, la IA queda en silencio y el chat
del usuario se actualiza solo (~5s) para mostrar las respuestas de la enfermera; al resolver el aviso,
la conversación se cierra.
