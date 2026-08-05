-- Slice 2b: the nurse replies to the user through the chat (message role = 'nurse').
-- Allow the authenticated nurse to insert messages (anonymous user messages still go via service role).
create policy "nurse inserts messages" on messages for insert to authenticated with check (true);
