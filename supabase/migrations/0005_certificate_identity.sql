-- The person chatting is often the parent (conversations.patient_name/rut), but the school
-- certificate must name the student. The generate_certificate tool now collects the student's
-- name + RUT; store them here so the PDF endpoint uses them instead of the account holder.
alter table conversations add column certificate_name text;
alter table conversations add column certificate_rut  text;
