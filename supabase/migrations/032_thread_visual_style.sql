-- 032: Allow a Studio thread to pin a visual style preset (e.g. photorealistic,
-- cinematic, illustrated, UGC) that drives both the structured creative
-- direction AND the auto-chained image_prompt.
--
-- The value is a free-form short token (rather than an enum) so we can grow
-- the preset list app-side without schema churn. The Studio UI maps known
-- tokens to labels + prompt fragments via `lib/studio/visual-styles.ts`;
-- unknown tokens degrade gracefully (passed through verbatim to the model).
--
-- Nullable: when unset, the model relies purely on the brand's `style_tags`
-- and template (legacy behavior — keeps existing threads untouched).

alter table public.threads
  add column if not exists visual_style text;

comment on column public.threads.visual_style is
  'Optional visual style preset id (e.g. photorealistic, cinematic, illustrated). Read by /api/creative/* routes and woven into the creative + image prompts.';
