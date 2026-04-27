-- 029: Visual templates — thumbnail_url + storage bucket for user-uploaded
-- template thumbnails.
--
-- The Studio side panel surfaces ad templates as thumbnail cards (the user
-- recognises a layout faster than they read its name). System templates ship
-- their thumbnails from /public/templates (served by Next), while
-- brand-owned templates upload into the `template-thumbnails` bucket.
--
-- Why a single text column instead of going through assets+links: templates
-- are global-or-brand-scoped (system templates have brand_id = null) and the
-- assets table requires brand_id. A simple URL keeps both code paths
-- uniform and avoids special-casing assets for system rows.

alter table public.templates
  add column if not exists thumbnail_url text;

comment on column public.templates.thumbnail_url is
  'Public URL of the template preview image (either /templates/<key>.png for system templates or a Supabase Storage URL for brand-uploaded templates).';

-- Storage bucket for brand-uploaded template thumbnails. Public-read so the
-- Studio side panel and any future preview surfaces can render them by URL.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'template-thumbnails',
  'template-thumbnails',
  true,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "template_thumbnails_authenticated_insert" on storage.objects;
create policy "template_thumbnails_authenticated_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'template-thumbnails');

drop policy if exists "template_thumbnails_public_select" on storage.objects;
create policy "template_thumbnails_public_select"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'template-thumbnails');

drop policy if exists "template_thumbnails_authenticated_update" on storage.objects;
create policy "template_thumbnails_authenticated_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'template-thumbnails')
  with check (bucket_id = 'template-thumbnails');

drop policy if exists "template_thumbnails_authenticated_delete" on storage.objects;
create policy "template_thumbnails_authenticated_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'template-thumbnails');

-- ----------------------------------------------------------------------------
-- System templates (visual / image-based)
-- ----------------------------------------------------------------------------
-- The 12 templates below ship as the default catalog. Each one corresponds
-- to a thumbnail file uploaded to the `template-thumbnails` bucket under
-- `system/<key>.png`. The side panel uses the thumbnail as the preview AND
-- the image-generation pipeline passes it to gpt-image-1 as a layout
-- reference.
--
-- We store the bucket-relative path here (not an absolute URL) so the
-- migration is portable across Supabase projects. Both the side panel and
-- the AI context layer resolve the path via `storage.from(bucket).getPublicUrl(...)`
-- at request time.
--
-- The actual PNGs are uploaded by `apps/web/scripts/upload-system-template-thumbnails.ts`.
-- Run it once after applying this migration on a fresh project.
--
-- We delete first (instead of `on conflict`) because the templates unique
-- constraint is `(brand_id, key)` and PostgreSQL's default UNIQUE treats
-- nulls as distinct — so an upsert keyed on a null brand_id would just
-- create duplicates. `threads.template_id` is `on delete set null`, so
-- removing and re-creating system rows is safe.

delete from public.templates
where brand_id is null
  and key in (
    'benefits_grid', 'stats_quadrant', 'social_proof_review',
    'stat_callouts', 'sale_hero', 'bullet_benefits', 'feature_checklist',
    'annotated_callouts', 'this_or_that', 'comparison_visual',
    'cinematic_hook', 'them_vs_us'
  );

-- Deactivate the original text-only seed templates. They were placeholders
-- before the visual catalog landed; leaving them visible alongside thumbnail
-- cards would make the picker look half-finished. The rows are kept (not
-- deleted) so any historical thread referencing them still resolves a name.
update public.templates
set is_active = false
where brand_id is null
  and key in (
    'problem_solution', 'before_after', 'ugc_testimonial',
    'benefit_first', 'list_reasons'
  );

-- The `structure` jsonb is intentionally short: gpt-image-1 reads the
-- thumbnail as a reference image (see image-generation pipeline), so the
-- text guidelines focus on what to ADAPT (product/copy swap), not what the
-- layout looks like (the image already shows that).

insert into public.templates (brand_id, key, name, description, category, structure, is_system, is_active, thumbnail_url)
values
  (null, 'benefits_grid', 'Benefits Grid', 'Bold question hook over a 3×3 grid of supporting ingredients/benefits with the product as anchor.', 'education',
   '{"layout":"hook + 3x3 ingredient/benefit grid + product anchor + sale badge","sections":["hook_question","benefit_grid","product_anchor","offer_badge"],"guidelines":"Open with a punchy question that names the audience or pain. Each tile in the grid is one ingredient or benefit with a circular photo + label."}'::jsonb,
   true, true, 'system/benefits-grid.png'),

  (null, 'stats_quadrant', 'Stats Quadrant', 'Four-panel layout: brand line, hero shot, lifestyle shot, and a stats block.', 'education',
   '{"layout":"2x2 quadrant — brand statement, product texture, in-use shot, key stats","sections":["brand_statement","product_texture","in_use_shot","stats_block"],"guidelines":"One quadrant per idea. Stats column uses 2-4 large numbers with one-word labels (vitamins, fiber, sugar, calories)."}'::jsonb,
   true, true, 'system/stats-quadrant.png'),

  (null, 'social_proof_review', 'Social Proof Review', 'Big editorial headline with a screenshotted customer review and the product underneath.', 'social_proof',
   '{"layout":"editorial headline + screenshot-style customer testimonial + product shot","sections":["headline","testimonial_card","product_shot"],"guidelines":"Headline is short and emotional (audience callout). Testimonial mimics a real iMessage/Facebook review with avatar + name + verbatim quote. Product is bottom-anchored."}'::jsonb,
   true, true, 'system/social-proof-review.png'),

  (null, 'stat_callouts', 'Stat Callouts', 'Big claim, hero product on the left, three pill-shaped stat callouts on the right.', 'feature_focus',
   '{"layout":"two-column — product hero left, headline + 3 stat pills right","sections":["headline","product_hero","stat_pill_1","stat_pill_2","stat_pill_3"],"guidelines":"Stat pills use a black rounded shape with a big number + small descriptor (e.g. 40g protein). Optional offer chip in the top corner."}'::jsonb,
   true, true, 'system/stat-callouts.png'),

  (null, 'sale_hero', 'Sale Hero', 'Premium product hero with a dramatic price tag and a benefit-led headline at the bottom.', 'offer',
   '{"layout":"hero product on rich background + price tag + bottom headline + guarantee strip","sections":["price_tag","product_hero","bottom_headline","guarantee_strip"],"guidelines":"Background is a saturated branded gradient. Price tag shows discounted price with the original struck through. Bottom headline is the benefit promise; thin guarantee line below."}'::jsonb,
   true, true, 'system/sale-hero.png'),

  (null, 'bullet_benefits', 'Bullet Benefits', 'Handwritten-style headline with the product on the left and 2-3 bulleted benefits on the right.', 'benefit_driven',
   '{"layout":"headline at top + product photo left + bulleted benefits right + fine print","sections":["headline","product_photo","benefit_bullets","fine_print"],"guidelines":"Headline reads like a personal story (\"I Accidentally Lost 12 Pounds At 52\"). 2-3 short bullets, each one outcome. Disclaimer in tiny grey text at the bottom."}'::jsonb,
   true, true, 'system/bullet-benefits.png'),

  (null, 'feature_checklist', 'Feature Checklist', 'Top headline + plus-mark feature checklist + product hero in the lower half.', 'benefit_driven',
   '{"layout":"top headline + plus-icon feature checklist + product hero below","sections":["top_headline","feature_checklist","product_hero"],"guidelines":"Headline is bold and ALL CAPS. Each checklist row starts with a coloured + icon and a one-line feature. Product fills the bottom 60% on a clean background."}'::jsonb,
   true, true, 'system/feature-checklist.png'),

  (null, 'annotated_callouts', 'Annotated Callouts', 'Lifestyle product photo with pill-shaped callouts pointing to features around it.', 'feature_focus',
   '{"layout":"hero product photo + 4-6 pill callouts with leader dots pointing at the product","sections":["headline","product_photo","callout_pills"],"guidelines":"Each callout is one short benefit on a coloured pill (rounded rect) with a small dot connector aimed at the relevant area of the product. Top headline introduces the offer."}'::jsonb,
   true, true, 'system/annotated-callouts.png'),

  (null, 'this_or_that', 'This or That', 'Two SKUs side by side with a "Left or right?" question prompt and a CTA below.', 'engagement',
   '{"layout":"side-by-side product comparison + question headline + CTA line","sections":["question_headline","product_left","product_right","cta_line"],"guidelines":"Headline is a playful question (\"Left or right?\"). Both products centred against a soft neutral background. CTA below invites engagement (\"Just add both — one is on us\")."}'::jsonb,
   true, true, 'system/this-or-that.png'),

  (null, 'comparison_visual', 'Comparison Visual', 'Two-panel "this vs that" visual demo with a one-line tagline and brand mark.', 'before_after',
   '{"layout":"two photo panels with one-word labels + tagline + brand mark","sections":["panel_a","panel_b","tagline","brand_mark"],"guidelines":"Each panel is the SAME object photographed twice with one element changed (without product / with product). Caption beneath each panel is 2-3 words. Tagline ties the contrast to the brand."}'::jsonb,
   true, true, 'system/comparison-visual.png'),

  (null, 'cinematic_hook', 'Cinematic Hook', 'Cinematic full-bleed photo with a circular inset and a 3-line ALL-CAPS hook on the bottom.', 'story_hook',
   '{"layout":"full-bleed cinematic photo + circular inset photo + 3-line ALL CAPS hook bar","sections":["hero_photo","circular_inset","hook_bar"],"guidelines":"Hero photo carries 70% of the frame (product or context). A small circular inset in the upper corner adds proof (e.g. user, scenario). Bottom 30% is a dark scrim with white ALL-CAPS hook in 2-3 short lines."}'::jsonb,
   true, true, 'system/cinematic-hook.png'),

  (null, 'them_vs_us', 'Them vs Us', 'Side-by-side competitor comparison with negative callouts on the left and the clean product on the right.', 'comparison',
   '{"layout":"left column = competitor + negative callouts; right column = our product + positive line","sections":["left_label","competitor_image","negative_callouts","right_label","product_image","positive_callout"],"guidelines":"Saturated brand colour background. Left side shows the competitor with 3-4 negative callouts in pill shapes. Right side shows our product with a single positive line (\"None of that.\"). Brand mark in the bottom right."}'::jsonb,
   true, true, 'system/them-vs-us.png');
