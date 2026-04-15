-- 021: Storage bucket + policies for generated creative images
-- Used by apps/web/lib/ai/services/image-generation.ts (bucket id: creative-assets)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'creative-assets',
  'creative-assets',
  true,
  52428800,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- storage.objects RLS: without policies, uploads are denied even when the bucket exists

drop policy if exists "creative_assets_authenticated_insert" on storage.objects;
create policy "creative_assets_authenticated_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'creative-assets');

drop policy if exists "creative_assets_public_select" on storage.objects;
create policy "creative_assets_public_select"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'creative-assets');

drop policy if exists "creative_assets_authenticated_update" on storage.objects;
create policy "creative_assets_authenticated_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'creative-assets')
  with check (bucket_id = 'creative-assets');

drop policy if exists "creative_assets_authenticated_delete" on storage.objects;
create policy "creative_assets_authenticated_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'creative-assets');
