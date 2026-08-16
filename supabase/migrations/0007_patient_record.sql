-- Ficha de seguimiento: the operational subset of a patient the AI may read back verbatim.
-- See docs/adr/0007-per-patient-verbatim-record.md (amplía 0004).
--
-- Deliberately excluded: diagnóstico, tipo de trasplante, peso. Peso exists in a transplant
-- record almost solely to compute doses, which is the one thing the AI must never do.
-- This is the first health data this app stores; Ley 19.628 review applies before production.

alter table patients
  add column next_appointment_at    timestamptz,
  add column next_appointment_place text,
  add column medications  jsonb not null default '[]'::jsonb,
  add column allergies    text,
  add column restrictions text,
  -- Where the record came from. Today always 'manual'; 'his' is the seam for a future
  -- read-only pull from the hospital's ficha clínica system (join key: patients.rut).
  add column record_source text not null default 'manual'
    check (record_source in ('manual', 'his')),
  add column record_synced_at timestamptz;

-- 0006 granted staff only select + insert, so patients were write-once by omission.
-- The record has to be editable: the nurse completes it over time, not all at once at discharge.
create policy "staff updates patients" on patients for update to authenticated
  using ((auth.jwt() ->> 'is_anonymous')::boolean = false)
  with check ((auth.jwt() ->> 'is_anonymous')::boolean = false);
