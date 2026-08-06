-- Slice 3: nurse-provisioned patient links (see docs/adr/0006-nurse-provisioned-patient-links.md).
-- The nurse registers the patient (the child) at discharge; the family gets a stable link bound to it.
-- Entry is no longer self-serve, so identity is captured once, by someone who knows it, and is verified.

create table patients (
  id         uuid primary key default gen_random_uuid(),
  token      text unique not null,        -- unguessable magic-link secret (crypto.randomUUID)
  name       text not null,               -- the child / student (subject of the certificate)
  rut        text not null,               -- Chilean national ID, formatted
  created_at timestamptz not null default now()
);

-- A conversation belongs to a patient; patient_name/rut stay as a denormalized snapshot copied at
-- creation, so the chat/certificate/dashboard queries that already read them need no joins.
alter table conversations add column patient_id uuid references patients(id);

-- The student identity is now the patient's; the separate certificate columns (0005) are redundant.
alter table conversations drop column certificate_name;
alter table conversations drop column certificate_rut;

-- RLS: only staff (authenticated, non-anonymous) touch patients. The patient-link entry route uses the
-- service role (bypasses RLS) to read a patient and create its conversation.
alter table patients enable row level security;
create policy "staff reads patients" on patients for select to authenticated
  using ((auth.jwt() ->> 'is_anonymous')::boolean = false);
create policy "staff inserts patients" on patients for insert to authenticated
  with check ((auth.jwt() ->> 'is_anonymous')::boolean = false);
