-- Seed: plans
--
-- System templates are seeded by migration 029_template_thumbnails.sql so
-- they ship with thumbnails and a uniform layout shape. Re-inserting them
-- here would duplicate rows because `templates.unique (brand_id, key)`
-- treats null brand_ids as distinct.

-- Plans
insert into public.plans (code, name, monthly_price_cents, monthly_credit_limit, max_brands, features, is_public, is_active) values
  ('starter', 'Starter', 7900, 2500, 1, '{
    "creative_generation": true,
    "icp_generation": true,
    "website_import": true,
    "competitor_insights": false,
    "priority_generation": false,
    "image_generation": true
  }'::jsonb, true, true),

  ('pro', 'Pro', 11900, 5000, 3, '{
    "creative_generation": true,
    "icp_generation": true,
    "website_import": true,
    "competitor_insights": true,
    "priority_generation": true,
    "image_generation": true
  }'::jsonb, true, true),

  ('enterprise', 'Enterprise', 0, 10000, null, '{
    "creative_generation": true,
    "icp_generation": true,
    "website_import": true,
    "competitor_insights": true,
    "priority_generation": true,
    "image_generation": true,
    "dedicated_support": true,
    "custom_templates": true
  }'::jsonb, false, true);
