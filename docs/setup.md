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

3. **Base de datos**: ejecutar `supabase/migrations/0001_init.sql` en el proyecto de Supabase
   (SQL Editor del panel, o `supabase db push` si usas la CLI).

4. **Cuenta de la enfermera**: en el panel de Supabase → Authentication → Users → crear un usuario
   (email + contraseña). Es la cuenta única compartida para el dashboard.

5. **Levantar el proyecto**
   ```bash
   pnpm dev
   ```
   - Chat público: <http://localhost:3000>
   - Dashboard enfermera: <http://localhost:3000/dashboard>

## Alcance de este slice
Chat público → Claude responde o escala → aviso en la bandeja de la enfermera → la enfermera
reclasifica prioridad y resuelve. **Pendiente (Slice 2):** certificado del colegio en PDF y
respuesta de la enfermera al usuario por el mismo chat.
