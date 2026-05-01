-- 036: Track when a brand's template folders have been seeded.
--
-- The Studio now treats every template as belonging to exactly one folder
-- (no more "Unsorted"), and the built-in category-derived buckets are
-- promoted from virtual-only to real `template_folders` rows so users can
-- rename / delete / manage them like any folder they created themselves.
--
-- We seed those default folders once per brand, lazily, on first studio
-- load. This column is how we remember we've done it — it stays set even
-- if the user later deletes every folder, so we never re-seed out from
-- under their curation choices.

alter table public.brands
  add column if not exists templates_initialized_at timestamptz;

comment on column public.brands.templates_initialized_at is
  'When the brand''s default template folders were seeded from system template categories. Null = not yet seeded; the Studio will seed on next load. Once set, never re-seeded even if folders are all deleted.';
