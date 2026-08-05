-- Slice 2: school-attendance certificate issued from the chat (Claude generate_certificate tool).
-- Set when the certificate is authorized/issued; the PDF endpoint is gated on this being non-null.
alter table conversations add column certificate_issued_at timestamptz;
