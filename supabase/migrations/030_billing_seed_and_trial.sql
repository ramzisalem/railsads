-- 030: Idempotent plan seed + trial credit backfill
--
-- The seed.sql file is only re-run on `supabase db reset`. Production deploys
-- only run the migrations folder, so on remote we have an empty `plans` table
-- and the credit gate has no source of truth for plan limits. This migration
-- inserts (or updates) the canonical plan rows, and backfills a one-time
-- trial credit grant for every existing brand that has no subscription.

-- ---------------------------------------------------------------------------
-- 1) Plans (idempotent — safe to re-run on every deploy)
-- ---------------------------------------------------------------------------

insert into public.plans
  (code, name, monthly_price_cents, monthly_credit_limit, max_brands, features, is_public, is_active)
values
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
  }'::jsonb, false, true)
on conflict (code) do update set
  name = excluded.name,
  monthly_price_cents = excluded.monthly_price_cents,
  monthly_credit_limit = excluded.monthly_credit_limit,
  max_brands = excluded.max_brands,
  features = excluded.features,
  is_public = excluded.is_public,
  is_active = excluded.is_active,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- 2) Trial credits — every brand without an active subscription gets a one-
--    time 100 credit `trial_grant` so users can experience the product
--    before being asked to upgrade. The unique partial index below makes
--    the grant exactly once per brand.
-- ---------------------------------------------------------------------------

create unique index if not exists credit_ledger_one_trial_per_brand_idx
  on public.credit_ledger (brand_id)
  where reason = 'trial_grant';

insert into public.credit_ledger (brand_id, reason, delta, metadata)
select
  b.id,
  'trial_grant'::public.credit_reason,
  100,
  jsonb_build_object('source', 'backfill_migration_030', 'note', 'one-time trial grant')
from public.brands b
left join public.subscriptions s
  on s.brand_id = b.id
  and s.status in ('active','trialing','past_due')
left join public.credit_ledger cl
  on cl.brand_id = b.id
  and cl.reason = 'trial_grant'
where s.id is null
  and cl.id is null;
