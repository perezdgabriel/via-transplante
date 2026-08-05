# Inicio de sesión anónimo para Realtime del paciente

## Status

accepted

## Contexto y decisión

El paciente no tiene login (link público), pero para recibir las respuestas de la enfermera en vivo
por Realtime necesitábamos una identidad que RLS pudiera usar: el rol `anon` no puede leer la tabla
`messages` de forma segura por conversación. Decidimos usar **inicio de sesión anónimo de Supabase**
(`signInAnonymously`), que crea de forma silenciosa (sin formulario) un usuario `authenticated` con un
`auth.uid()` estable. Cada conversación guarda `owner_id = auth.uid()` del paciente, y RLS permite al
paciente leer solo sus conversaciones y mensajes. Así el Realtime de `messages` funciona con seguridad.

El **RUT sigue siendo solo un organizador** (agrupa consultas en el dashboard), no una llave de acceso;
el **token secreto sigue siendo la credencial** de reingreso entre dispositivos ([[0001-tokenless-public-chat-reentry]]).

## Considered Options

- **`postgres_changes` con rol `anon`** — descartado: no hay forma segura de acotar `messages` por
  conversación para `anon` sin exponer datos de otros pacientes.
- **Canal Broadcast por token** — descartado por ahora: push instantáneo sin tabla, pero más difícil de
  verificar sin infraestructura en vivo.
- **Solo polling (~5s)** — funciona y quedó como respaldo, pero no es push.

## Consequences

- El paciente y la enfermera comparten el rol `authenticated`. Por eso **todas las políticas de personal
  se re-acotaron a usuarios NO anónimos** (`is_anonymous = false`) y se agregaron políticas por dueño;
  un descuido aquí expondría datos entre pacientes. Ver `supabase/migrations/0004_patient_realtime.sql`.
- El Realtime es por dispositivo (la sesión anónima vive en ese navegador). Entre dispositivos, el
  reingreso por token carga el historial pero sin actualización en vivo. Es el trade-off aceptado.
- Se acumulan usuarios anónimos en `auth.users` (~por dispositivo). Conviene limpieza periódica y
  proteger el endpoint (CAPTCHA / rate limit), ya que es público.
- Hay que **habilitar "Anonymous Sign-Ins"** en el panel de Supabase para que funcione.
