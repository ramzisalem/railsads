-- 034: Multi-template threads.
--
-- Until now each Studio thread could only be anchored to a single
-- template (`threads.template_id`). Users can now select N templates
-- at once and have the Studio fan-out one creative per template in a
-- single "generate" turn.
--
-- We keep `template_id` in place as the "primary" pointer (the first
-- element of `template_ids`) because:
--   1. The image generation pipeline reads it to pull a template
--      thumbnail for gpt-image-1. Thread-level single-template callers
--      (manual image regen, legacy clients) keep working unchanged.
--   2. Downstream reports / exports that may have been keyed on
--      `template_id` don't have to be migrated in one go.
--
-- `template_ids` is the new source of truth for the picker. Backfill
-- existing threads with a 1-element array derived from their current
-- `template_id` so nothing loses state.

alter table public.threads
  add column if not exists template_ids uuid[] not null default '{}';

update public.threads
   set template_ids = array[template_id]
 where template_id is not null
   and (template_ids is null or array_length(template_ids, 1) is null);

comment on column public.threads.template_ids is
  'Ordered set of templates selected for this thread. When length > 1, the Studio generates one creative per template per turn. `template_id` mirrors `template_ids[0]` as the primary anchor (used by legacy single-template flows such as image regeneration).';

comment on column public.threads.template_id is
  'Primary template (mirrors `template_ids[0]`). Kept for back-compat with single-template flows like manual image regeneration.';
