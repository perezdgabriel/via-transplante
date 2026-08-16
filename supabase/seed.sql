-- DATOS DE DEMO. No son pacientes reales ni contenido clínico validado.
-- Existen para que el dashboard no esté vacío al mostrar la app a un hospital.
-- Igual que lib/knowledge-base.ts: NO debe correr en producción.
--
-- Correr después de las migraciones:  psql "$DATABASE_URL" -f supabase/seed.sql
-- (o pegarlo en el SQL Editor de Supabase). Es idempotente: los ids son fijos y todo
-- inserta con "on conflict do nothing", así que se puede volver a correr entre demos.
--
-- RUTs con dígito verificador válido (lib/rut.ts los acepta).

-- ── Pacientes ──────────────────────────────────────────────────────────────────
-- Sofía tiene la ficha completa: es la que se muestra en la demo.
-- Mateo tiene ficha parcial (sin alergias) para mostrar que la IA escala en vez de
-- afirmar que no tiene. Emilia no tiene ficha: la IA no sabe nada personalizado de ella.
insert into patients (id, token, name, rut, next_appointment_at, next_appointment_place,
                      medications, allergies, restrictions)
values
  ('11111111-1111-4111-8111-111111111111',
   'demo-sofia-0000-0000-000000000001',
   'Sofía Rojas Contreras', '11.111.111-1',
   now() + interval '18 days', 'Policlínico 2, 3er piso',
   '[{"name":"Tacrolimus","dose":"1 mg","frequency":"cada 12 horas","schedule":"8:00 y 20:00"},
     {"name":"Micofenolato","dose":"250 mg","frequency":"cada 12 horas","schedule":"con comida"},
     {"name":"Ácido fólico","dose":"5 mg","frequency":"1 vez al día","schedule":"8:00"}]'::jsonb,
   'Ninguna conocida',
   'Sin alimentos crudos (carnes, pescados, huevo). Sin deportes de contacto por ahora.'),

  ('22222222-2222-4222-8222-222222222222',
   'demo-mateo-0000-0000-000000000002',
   'Mateo Silva Fuentes', '12.345.678-5',
   now() + interval '3 days', 'Policlínico 2, 3er piso',
   '[{"name":"Tacrolimus","dose":"0,5 mg","frequency":"cada 12 horas","schedule":"9:00 y 21:00"},
     {"name":"Omeprazol","dose":"10 mg","frequency":"1 vez al día","schedule":"en ayunas"}]'::jsonb,
   null,  -- a propósito: la IA debe escalar, NO decir "no tiene alergias"
   'Sin alimentos crudos.'),

  ('33333333-3333-4333-8333-333333333333',
   'demo-emilia-0000-0000-00000000003',
   'Emilia Paredes Muñoz', '10.000.013-K',
   null, null, '[]'::jsonb, null, null)  -- sin ficha: nada personalizado que responder
-- Refresca la ficha al volver a correr. Los controles son relativos a now(), así que con
-- "do nothing" quedarían en el pasado a los pocos días, y los controles vencidos se omiten:
-- la pregunta estrella de la demo ("¿cuándo es el próximo control?") dejaría de responderse.
on conflict (id) do update set
  next_appointment_at    = excluded.next_appointment_at,
  next_appointment_place = excluded.next_appointment_place,
  medications            = excluded.medications,
  allergies              = excluded.allergies,
  restrictions           = excluded.restrictions;

-- ── Consultas ──────────────────────────────────────────────────────────────────
-- patient_name/rut son la copia denormalizada que hace la app al crear la conversación (0006).
insert into conversations (id, token, patient_id, patient_name, rut, summary, status, created_at, updated_at)
values
  ('a1111111-0000-4000-8000-000000000001', 'demo-conv-0001',
   '11111111-1111-4111-8111-111111111111', 'Sofía Rojas Contreras', '11.111.111-1',
   null, 'resolved', now() - interval '21 days', now() - interval '21 days'),
  ('a1111111-0000-4000-8000-000000000002', 'demo-conv-0002',
   '11111111-1111-4111-8111-111111111111', 'Sofía Rojas Contreras', '11.111.111-1',
   'Consulta por certificado de asistencia para el colegio.', 'resolved',
   now() - interval '9 days', now() - interval '9 days'),
  ('a1111111-0000-4000-8000-000000000003', 'demo-conv-0003',
   '11111111-1111-4111-8111-111111111111', 'Sofía Rojas Contreras', '11.111.111-1',
   null, 'ai_active', now() - interval '2 hours', now() - interval '2 hours'),
  ('a2222222-0000-4000-8000-000000000004', 'demo-conv-0004',
   '22222222-2222-4222-8222-222222222222', 'Mateo Silva Fuentes', '12.345.678-5',
   null, 'resolved', now() - interval '15 days', now() - interval '15 days'),
  ('a2222222-0000-4000-8000-000000000005', 'demo-conv-0005',
   '22222222-2222-4222-8222-222222222222', 'Mateo Silva Fuentes', '12.345.678-5',
   'Fiebre de 38,5 °C desde anoche, 3 semanas post-trasplante. Señal de alarma.', 'escalated',
   now() - interval '40 minutes', now() - interval '35 minutes'),
  ('a3333333-0000-4000-8000-000000000006', 'demo-conv-0006',
   '33333333-3333-4333-8333-333333333333', 'Emilia Paredes Muñoz', '10.000.013-K',
   'Pregunta por horario de toma de muestras.', 'resolved',
   now() - interval '5 days', now() - interval '5 days')
on conflict do nothing;

-- ── Mensajes ───────────────────────────────────────────────────────────────────
insert into messages (id, conversation_id, role, content, created_at)
values
  ('b0000000-0000-4000-8000-000000000001', 'a1111111-0000-4000-8000-000000000001', 'user',
   '¿A qué hora atiende el policlínico?', now() - interval '21 days'),
  ('b0000000-0000-4000-8000-000000000002', 'a1111111-0000-4000-8000-000000000001', 'assistant',
   'El policlínico atiende de lunes a viernes de 8:00 a 17:00.', now() - interval '21 days' + interval '20 seconds'),

  ('b0000000-0000-4000-8000-000000000003', 'a1111111-0000-4000-8000-000000000002', 'user',
   'Necesito un certificado para el colegio de Sofía.', now() - interval '9 days'),
  ('b0000000-0000-4000-8000-000000000004', 'a1111111-0000-4000-8000-000000000002', 'assistant',
   'Listo, generé el certificado de asistencia. Puedes descargarlo desde este chat.',
   now() - interval '9 days' + interval '25 seconds'),

  ('b0000000-0000-4000-8000-000000000005', 'a1111111-0000-4000-8000-000000000003', 'user',
   '¿Cuándo es el próximo control de Sofía?', now() - interval '2 hours'),
  ('b0000000-0000-4000-8000-000000000006', 'a1111111-0000-4000-8000-000000000003', 'assistant',
   'Su próximo control está agendado en el Policlínico 2, 3er piso. Si necesitas cambiar la hora, avísame y derivo tu caso a una enfermera.',
   now() - interval '2 hours' + interval '15 seconds'),

  ('b0000000-0000-4000-8000-000000000007', 'a2222222-0000-4000-8000-000000000004', 'user',
   '¿Mateo puede comer sushi?', now() - interval '15 days'),
  ('b0000000-0000-4000-8000-000000000008', 'a2222222-0000-4000-8000-000000000004', 'assistant',
   'En su ficha figura: "Sin alimentos crudos." El sushi con pescado crudo queda fuera por esa indicación.',
   now() - interval '15 days' + interval '18 seconds'),

  ('b0000000-0000-4000-8000-000000000009', 'a2222222-0000-4000-8000-000000000005', 'user',
   'Mateo tiene 38,5 de fiebre desde anoche y está decaído.', now() - interval '40 minutes'),
  ('b0000000-0000-4000-8000-000000000010', 'a2222222-0000-4000-8000-000000000005', 'assistant',
   'Derivé tu caso a una enfermera; te va a contactar por este mismo chat a la brevedad.',
   now() - interval '40 minutes' + interval '12 seconds'),
  ('b0000000-0000-4000-8000-000000000011', 'a2222222-0000-4000-8000-000000000005', 'user',
   '¿Le puedo dar paracetamol mientras tanto?', now() - interval '35 minutes'),

  ('b0000000-0000-4000-8000-000000000012', 'a3333333-0000-4000-8000-000000000006', 'user',
   '¿Hasta qué hora se toman muestras de sangre?', now() - interval '5 days'),
  ('b0000000-0000-4000-8000-000000000013', 'a3333333-0000-4000-8000-000000000006', 'assistant',
   'La toma de muestras es de lunes a viernes de 7:30 a 11:00, sin hora previa.',
   now() - interval '5 days' + interval '22 seconds')
on conflict do nothing;

-- ── Aviso activo en la bandeja ─────────────────────────────────────────────────
insert into alerts (id, conversation_id, priority, status, created_at)
values
  ('c0000000-0000-4000-8000-000000000001', 'a2222222-0000-4000-8000-000000000005',
   'urgent', 'active', now() - interval '40 minutes')
-- Igual que la ficha: se refresca al volver a correr, para que el aviso de la bandeja no
-- aparezca con semanas de antigüedad en la próxima demo.
on conflict (id) do update set
  status     = 'active',
  priority   = 'urgent',
  created_at = excluded.created_at,
  resolved_at = null,
  internal_note = null;
