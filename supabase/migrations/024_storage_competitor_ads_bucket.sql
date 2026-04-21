-- 024: Storage bucket + policies for competitor ad screenshots / creatives.
-- Used by apps/web/lib/competitors/actions.ts (uploads) and the
-- /api/competitors/ads/extract route (vision extraction).
--
-- Bucket id: `competitor-ads`. Public-read so OpenAI vision and the dashboard
-- can fetch images by URL. Writes restricted to authenticated users; the app
-- still scopes uploads under `${brandId}/${competitorId}/...` and gates writes
-- behind brand membership checks at the route layer.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'competitor-ads',
  'competitor-ads',
  true,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "competitor_ads_authenticated_insert" on storage.objects;
create policy "competitor_ads_authenticated_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'competitor-ads');

drop policy if exists "competitor_ads_public_select" on storage.objects;
create policy "competitor_ads_public_select"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'competitor-ads');

drop policy if exists "competitor_ads_authenticated_update" on storage.objects;
create policy "competitor_ads_authenticated_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'competitor-ads')
  with check (bucket_id = 'competitor-ads');

drop policy if exists "competitor_ads_authenticated_delete" on storage.objects;
create policy "competitor_ads_authenticated_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'competitor-ads');
