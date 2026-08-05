-- Slice 1 schema: conversations, messages, alerts.
-- All identifiers in English (project convention). UI/domain terms: conversación, mensaje, aviso.

create type priority as enum ('urgent', 'normal', 'informative');
create type conversation_status as enum ('ai_active', 'escalated', 'resolved');
create type alert_status as enum ('active', 'resolved');

create table conversations (
  id           uuid primary key default gen_random_uuid(),
  token        text unique not null,           -- unguessable re-entry key for the anonymous user
  patient_name text not null,
  rut          text not null,                  -- Chilean national ID (formatted, no diagnosis stored)
  summary      text,                           -- AI-written case summary, set on escalation
  status       conversation_status not null default 'ai_active',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  role            text not null check (role in ('user', 'assistant', 'nurse')),
  content         text not null,
  created_at      timestamptz not null default now()
);
create index messages_conversation_idx on messages (conversation_id, created_at);

create table alerts (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  priority        priority not null default 'normal',
  status          alert_status not null default 'active',
  internal_note   text,
  resolved_at     timestamptz,
  created_at      timestamptz not null default now()
);
create index alerts_active_idx on alerts (status, created_at desc);

-- RLS: anonymous chat writes go through the service role (bypasses RLS) in server routes.
-- The nurse dashboard uses an authenticated Supabase session; grant it read/write on staff data.
alter table conversations enable row level security;
alter table messages       enable row level security;
alter table alerts         enable row level security;

create policy "nurse reads conversations" on conversations for select to authenticated using (true);
create policy "nurse updates conversations" on conversations for update to authenticated using (true);
create policy "nurse reads messages" on messages for select to authenticated using (true);
create policy "nurse reads alerts" on alerts for select to authenticated using (true);
create policy "nurse updates alerts" on alerts for update to authenticated using (true);

-- Realtime push for the dashboard inbox.
alter publication supabase_realtime add table alerts;
