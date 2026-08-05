-- Slice 2c: patient Realtime via Supabase anonymous sign-in.
-- Each conversation is owned by the patient's anonymous auth user (auth.uid()). RUT stays an
-- organizer only; the unguessable token remains the cross-device access secret.
--
-- Both the nurse and anonymous patients use the `authenticated` role, so every existing "staff can do
-- anything" policy is re-scoped to NON-anonymous users, and patients get owner-scoped read access.
-- Staff check: is_anonymous must be explicitly false (a missing claim grants nothing).

alter table conversations add column owner_id uuid;

-- conversations
drop policy "nurse reads conversations" on conversations;
drop policy "nurse updates conversations" on conversations;
create policy "staff reads conversations" on conversations for select to authenticated
  using ((auth.jwt() ->> 'is_anonymous')::boolean = false);
create policy "staff updates conversations" on conversations for update to authenticated
  using ((auth.jwt() ->> 'is_anonymous')::boolean = false);
create policy "owner reads conversation" on conversations for select to authenticated
  using (owner_id = auth.uid());

-- messages
drop policy "nurse reads messages" on messages;
drop policy "nurse inserts messages" on messages;
create policy "staff reads messages" on messages for select to authenticated
  using ((auth.jwt() ->> 'is_anonymous')::boolean = false);
create policy "staff inserts messages" on messages for insert to authenticated
  with check ((auth.jwt() ->> 'is_anonymous')::boolean = false);
create policy "owner reads messages" on messages for select to authenticated
  using (
    exists (
      select 1 from conversations c
      where c.id = messages.conversation_id and c.owner_id = auth.uid()
    )
  );

-- alerts stay staff-only (patients never read them)
drop policy "nurse reads alerts" on alerts;
drop policy "nurse updates alerts" on alerts;
create policy "staff reads alerts" on alerts for select to authenticated
  using ((auth.jwt() ->> 'is_anonymous')::boolean = false);
create policy "staff updates alerts" on alerts for update to authenticated
  using ((auth.jwt() ->> 'is_anonymous')::boolean = false);

-- Patient Realtime needs message inserts published (respects RLS per subscriber).
alter publication supabase_realtime add table messages;
