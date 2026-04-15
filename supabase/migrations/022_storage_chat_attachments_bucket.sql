-- 022: User-uploaded images attached to studio chat messages (vision on revise/generate)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-attachments',
  'chat-attachments',
  true,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "chat_attachments_authenticated_insert" on storage.objects;
create policy "chat_attachments_authenticated_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'chat-attachments');

drop policy if exists "chat_attachments_public_select" on storage.objects;
create policy "chat_attachments_public_select"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'chat-attachments');

drop policy if exists "chat_attachments_authenticated_update" on storage.objects;
create policy "chat_attachments_authenticated_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'chat-attachments')
  with check (bucket_id = 'chat-attachments');

drop policy if exists "chat_attachments_authenticated_delete" on storage.objects;
create policy "chat_attachments_authenticated_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'chat-attachments');
