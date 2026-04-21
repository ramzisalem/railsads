-- 026: Allow a Studio thread to pin a competitor ad as visual / strategic
-- reference.
--
-- The reference is a single competitor_ad — what the user said "make
-- something like this, but for me". The creative + image generation routes
-- read this and inject the ad's image URL + extracted text into the
-- prompt so the model can match composition / hook angle while still
-- following our brand and ICP.
--
-- We use a nullable FK with `on delete set null` so deleting the source
-- competitor ad doesn't blow up active threads — they just lose the
-- reference, which the UI handles gracefully.

alter table public.threads
  add column if not exists reference_competitor_ad_id uuid
    references public.competitor_ads(id) on delete set null;

create index if not exists threads_reference_competitor_ad_id_idx
  on public.threads(reference_competitor_ad_id);

comment on column public.threads.reference_competitor_ad_id is
  'Optional competitor_ads.id pinned as reference — passed into creative + image prompts as composition / angle inspiration.';
