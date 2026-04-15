You’re right — what I gave you was **only partially formatted**, not the full cleaned document. Let me fix that properly.

Below is your **FULL text, completely formatted, consistent, and readable**, without cutting anything.

---

# 📄 `db.md`

## 🧠 Database Architecture

The system is built around this model:

```text
Brand (workspace)
→ Brand Identity
→ Products
→ ICPs
→ Competitors
→ Creative Studio (threads, messages, versions, assets)
→ AI runs
→ Billing, subscriptions, credits, usage
```

---

## ⚙️ Core Principles

```text
Supabase Postgres = source of truth
Stripe = billing source of truth
Credits = internal usage abstraction
Every business object belongs to a brand
Threads are the source of truth for creative work
Immutable ledgers > mutable counters
```

---

# 1. Extensions

### Required

```sql
create extension if not exists pgcrypto;
create extension if not exists citext;
```

### Optional (later)

```sql
create extension if not exists pg_trgm;
create extension if not exists vector;
```

> Use `vector` only when adding semantic retrieval.

---

# 2. Enums

```sql
create type public.brand_role as enum ('owner','admin','member');

create type public.member_status as enum ('invited','active','removed');

create type public.brand_status as enum ('active','paused','archived');

create type public.product_status as enum ('draft','active','archived');

create type public.competitor_status as enum ('active','archived');

create type public.thread_status as enum ('active','archived');

create type public.message_role as enum ('user','assistant','system');

create type public.awareness_level as enum (
  'unaware',
  'problem_aware',
  'solution_aware',
  'product_aware',
  'most_aware'
);

create type public.asset_kind as enum (
  'brand_logo',
  'brand_cover',
  'product_image',
  'competitor_ad',
  'generated_image',
  'reference_image',
  'export_file'
);

create type public.asset_link_role as enum (
  'primary',
  'gallery',
  'reference',
  'selected',
  'export'
);

create type public.source_type as enum (
  'manual',
  'website_import',
  'ai_generated',
  'upload',
  'link'
);

create type public.import_status as enum ('queued','running','completed','failed');

create type public.ai_run_status as enum ('queued','running','completed','failed');

create type public.ai_service_type as enum (
  'brand_import',
  'icp_generation',
  'competitor_analysis',
  'creative_generation',
  'creative_revision',
  'image_generation',
  'thread_title'
);

create type public.subscription_status as enum (
  'trialing','active','past_due','canceled','unpaid','incomplete'
);

create type public.credit_reason as enum (
  'monthly_grant','trial_grant','manual_adjustment',
  'usage_deduction','refund','bonus'
);

create type public.usage_event_type as enum (
  'website_import',
  'icp_generation',
  'competitor_analysis',
  'creative_generation',
  'creative_revision',
  'image_generation',
  'export'
);
```

---

# 3. Users & Profiles

## `profiles`

```sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email citext,
  full_name text,
  avatar_url text,
  timezone text default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz
);
```

---

# 4. Workspaces / Brands

## `brands`

```sql
create table public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug citext not null unique,
  website_url text,
  default_currency text not null default 'USD',
  timezone text not null default 'UTC',
  status public.brand_status not null default 'active',
  onboarding_step text default 'website_import',
  onboarding_completed_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
```

## `brand_members`

```sql
create table public.brand_members (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.brand_role not null default 'member',
  status public.member_status not null default 'active',
  invited_by uuid references public.profiles(id) on delete set null,
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, user_id)
);
```

## `brand_invitations`

```sql
create table public.brand_invitations (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  email citext not null,
  role public.brand_role not null default 'member',
  invited_by uuid not null references public.profiles(id) on delete restrict,
  token text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
```

## `brand_settings`

```sql
create table public.brand_settings (
  brand_id uuid primary key references public.brands(id) on delete cascade,
  default_template_id uuid,
  default_awareness public.awareness_level,
  ui_preferences jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

---

# 5. Brand Identity

## `brand_profiles`

```sql
create table public.brand_profiles (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null unique references public.brands(id) on delete cascade,
  description text,
  category text,
  positioning text,
  value_proposition text,
  messaging_notes text,
  tone_tags text[] not null default '{}',
  personality_tags text[] not null default '{}',
  do_rules text[] not null default '{}',
  dont_rules text[] not null default '{}',
  source public.source_type not null default 'manual',
  raw_import_payload jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

---

# 6. Website / Import System

## `import_runs`

```sql
create table public.import_runs (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  source_type public.source_type not null,
  source_url text,
  status public.import_status not null default 'queued',
  pages_found integer default 0,
  model text,
  prompt_version text,
  result_summary jsonb,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
```

## `import_pages`

```sql
create table public.import_pages (
  id uuid primary key default gen_random_uuid(),
  import_run_id uuid not null references public.import_runs(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  page_url text not null,
  page_title text,
  content_storage_path text,
  extracted_payload jsonb,
  created_at timestamptz not null default now()
);
```

---

# 7. Products

## `products`

```sql
create table public.products (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  import_run_id uuid references public.import_runs(id) on delete set null,
  name text not null,
  slug citext,
  short_description text,
  description text,
  price_amount numeric(12,2),
  price_currency text default 'USD',
  product_url text,
  attributes jsonb not null default '{}',
  is_selected boolean not null default true,
  status public.product_status not null default 'active',
  source public.source_type not null default 'manual',
  raw_import_payload jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (brand_id, slug)
);
```

---

# 8. ICPs

## `icps`

```sql
create table public.icps (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  title text not null,
  summary text,
  pains text[] not null default '{}',
  desires text[] not null default '{}',
  objections text[] not null default '{}',
  triggers text[] not null default '{}',
  is_primary boolean not null default false,
  source public.source_type not null default 'ai_generated',
  source_ai_run_id uuid,
  raw_generation_payload jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
```

# 9. Competitors

## `competitors`

```sql
create table public.competitors (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  name text not null,
  website_url text,
  notes text,
  status public.competitor_status not null default 'active',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
```

## `product_competitor_links`

Map competitors to relevant products.

```sql
create table public.product_competitor_links (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  competitor_id uuid not null references public.competitors(id) on delete cascade,
  notes text,
  created_at timestamptz not null default now(),
  unique (product_id, competitor_id)
);
```

## `competitor_ads`

```sql
create table public.competitor_ads (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  competitor_id uuid not null references public.competitors(id) on delete cascade,
  mapped_product_id uuid references public.products(id) on delete set null,
  title text,
  source public.source_type not null,
  source_url text,
  landing_page_url text,
  platform text,
  ad_text text,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

## `competitor_analysis_runs`

This was missing before and is important for scale/debugging.

```sql
create table public.competitor_analysis_runs (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  competitor_id uuid references public.competitors(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  status public.ai_run_status not null default 'queued',
  model text,
  prompt_version text,
  summary text,
  raw_output jsonb,
  error_message text,
  created_by uuid references public.profiles(id) on delete set null,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
```

## `competitor_insights`

```sql
create table public.competitor_insights (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  competitor_id uuid references public.competitors(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  analysis_run_id uuid references public.competitor_analysis_runs(id) on delete set null,
  summary text,
  hook_patterns text[] not null default '{}',
  angle_patterns text[] not null default '{}',
  emotional_triggers text[] not null default '{}',
  visual_patterns text[] not null default '{}',
  offer_patterns text[] not null default '{}',
  cta_patterns text[] not null default '{}',
  confidence_score numeric(5,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

---

# 10. Templates

## `templates`

Store system and brand-specific templates in DB.

```sql
create table public.templates (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references public.brands(id) on delete cascade,
  key text not null,
  name text not null,
  description text,
  category text,
  structure jsonb not null,
  is_system boolean not null default true,
  is_active boolean not null default true,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, key)
);
```

For global templates, `brand_id` can be null.

---

# 11. Assets

A unified asset system is much more scalable than repeating `storage_path` in every domain table.

## `assets`

```sql
create table public.assets (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  kind public.asset_kind not null,
  bucket text not null,
  storage_path text not null,
  mime_type text,
  file_size_bytes bigint,
  width integer,
  height integer,
  checksum text,
  alt_text text,
  metadata jsonb not null default '{}',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
```

## `brand_asset_links`

```sql
create table public.brand_asset_links (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  role public.asset_link_role not null default 'primary',
  sort_order integer not null default 0,
  unique (brand_id, asset_id)
);
```

## `product_asset_links`

```sql
create table public.product_asset_links (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  role public.asset_link_role not null default 'gallery',
  sort_order integer not null default 0,
  unique (product_id, asset_id)
);
```

## `competitor_ad_asset_links`

```sql
create table public.competitor_ad_asset_links (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  competitor_ad_id uuid not null references public.competitor_ads(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  role public.asset_link_role not null default 'primary',
  unique (competitor_ad_id, asset_id)
);
```

---

# 12. Creative Studio

## `threads`

One thread = one creative workspace.

```sql
create table public.threads (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  icp_id uuid references public.icps(id) on delete set null,
  template_id uuid references public.templates(id) on delete set null,
  title text,
  angle text,
  awareness public.awareness_level,
  status public.thread_status not null default 'active',
  created_by uuid not null references public.profiles(id) on delete restrict,
  active_version_id uuid,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
```

## `thread_context_snapshots`

This is a key missing piece. It prevents historical drift when context changes later.

```sql
create table public.thread_context_snapshots (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  thread_id uuid not null references public.threads(id) on delete cascade,
  brand_snapshot jsonb,
  product_snapshot jsonb,
  icp_snapshot jsonb,
  template_snapshot jsonb,
  competitor_snapshot jsonb,
  settings_snapshot jsonb,
  created_at timestamptz not null default now()
);
```

## `messages`

```sql
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  thread_id uuid not null references public.threads(id) on delete cascade,
  role public.message_role not null,
  content text,
  structured_payload jsonb,
  context_snapshot_id uuid references public.thread_context_snapshots(id) on delete set null,
  ai_run_id uuid,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
```

## `creative_versions`

```sql
create table public.creative_versions (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  thread_id uuid not null references public.threads(id) on delete cascade,
  parent_version_id uuid references public.creative_versions(id) on delete set null,
  source_message_id uuid references public.messages(id) on delete set null,
  version_number integer not null,
  is_active boolean not null default false,
  selected_hook text,
  selected_headline text,
  selected_primary_text text,
  creative_direction jsonb,
  selected_blocks jsonb,
  context_snapshot_id uuid references public.thread_context_snapshots(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (thread_id, version_number)
);
```

## `creative_asset_links`

```sql
create table public.creative_asset_links (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  thread_id uuid not null references public.threads(id) on delete cascade,
  version_id uuid references public.creative_versions(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  role public.asset_link_role not null default 'selected',
  prompt_text text,
  created_at timestamptz not null default now()
);
```

## `exports`

```sql
create table public.exports (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  thread_id uuid references public.threads(id) on delete set null,
  version_id uuid references public.creative_versions(id) on delete set null,
  asset_id uuid references public.assets(id) on delete set null,
  export_type text not null,
  payload jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
```

---

# 13. AI / Model Usage / Cost Tracking

This is critical if you want scalable AI economics.

## `ai_runs`

```sql
create table public.ai_runs (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  thread_id uuid references public.threads(id) on delete set null,
  message_id uuid references public.messages(id) on delete set null,
  service_type public.ai_service_type not null,
  status public.ai_run_status not null default 'queued',
  model text not null,
  prompt_version text,
  input_tokens integer,
  output_tokens integer,
  total_tokens integer,
  estimated_cost_usd numeric(10,4),
  credits_charged integer,
  latency_ms integer,
  request_payload jsonb,
  response_payload jsonb,
  error_message text,
  created_by uuid references public.profiles(id) on delete set null,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
```

This table is essential for:

* debugging
* billing
* cost optimization
* model routing analytics

---

# 14. Billing / Plans / Stripe

## `plans`

This was missing from earlier versions and should be in DB, not only code.

```sql
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  monthly_price_cents integer not null,
  monthly_credit_limit integer not null,
  max_brands integer,
  features jsonb not null default '{}',
  is_public boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Recommended seed values:

* starter → 2500 credits
* pro → 5000 credits
* enterprise → custom

## `billing_customers`

```sql
create table public.billing_customers (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null unique references public.brands(id) on delete cascade,
  stripe_customer_id text not null unique,
  billing_email citext,
  country text,
  tax_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

## `subscriptions`

```sql
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null unique references public.brands(id) on delete cascade,
  plan_id uuid references public.plans(id) on delete set null,
  stripe_subscription_id text unique,
  stripe_price_id text,
  status public.subscription_status not null,
  seats integer not null default 1,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  trial_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

## `billing_invoices`

Not mandatory, but highly recommended for scalable billing visibility.

```sql
create table public.billing_invoices (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  stripe_invoice_id text not null unique,
  amount_due_cents integer,
  amount_paid_cents integer,
  currency text,
  status text,
  hosted_invoice_url text,
  invoice_pdf_url text,
  period_start timestamptz,
  period_end timestamptz,
  created_at timestamptz not null default now()
);
```

## `webhook_events`

This was definitely missing before. You need it for idempotency and safe Stripe sync.

```sql
create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null, -- stripe
  event_id text not null unique,
  event_type text not null,
  payload jsonb not null,
  status text not null default 'received',
  error_message text,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);
```

---

# 15. Credits & Usage

This is where previous schemas were too weak. A single mutable `usage_tracking` row is not enough.
Use an immutable ledger.

## `credit_ledger`

```sql
create table public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  usage_event_id uuid,
  reason public.credit_reason not null,
  delta integer not null, -- positive or negative
  period_start date,
  period_end date,
  reference_type text,
  reference_id uuid,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
```

Examples:

* `+2500` monthly grant
* `-15` creative generation
* `-25` image generation
* `+1000` manual bonus

## `usage_events`

```sql
create table public.usage_events (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  thread_id uuid references public.threads(id) on delete set null,
  ai_run_id uuid references public.ai_runs(id) on delete set null,
  event_type public.usage_event_type not null,
  credits integer not null,
  cash_cost_usd numeric(10,4),
  metadata jsonb not null default '{}',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
```

## `usage_monthly_rollups`

Optional but recommended for speed and analytics.

```sql
create table public.usage_monthly_rollups (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  month date not null,
  credits_granted integer not null default 0,
  credits_used integer not null default 0,
  creative_generations integer not null default 0,
  image_generations integer not null default 0,
  icp_generations integer not null default 0,
  competitor_analyses integer not null default 0,
  website_imports integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (brand_id, month)
);
```

---

# 16. Audit / Ops

## `audit_logs`

Very useful for admin support, enterprise readiness, and debugging.

```sql
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references public.brands(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);
```

---

# 17. Recommended Credit Mapping

This is not schema, but it should live next to the billing system.

```text
Creative generation  → 15 credits
Image generation     → 25 credits
ICP generation       → 5 credits
Competitor analysis  → 10 credits
Website import       → 20 credits
Creative iteration   → FREE
```

Plans:

```text
Starter    → 2,500 credits / month
Pro        → 5,000 credits / month
Enterprise → custom
```

---

# 18. Indexes You Should Definitely Add

At minimum:

```sql
create index idx_brand_members_brand_id on public.brand_members(brand_id);
create index idx_brand_members_user_id on public.brand_members(user_id);

create index idx_products_brand_id on public.products(brand_id);
create index idx_icps_brand_product on public.icps(brand_id, product_id);

create index idx_competitors_brand_id on public.competitors(brand_id);
create index idx_competitor_ads_competitor_id on public.competitor_ads(competitor_id);

create index idx_threads_brand_id on public.threads(brand_id);
create index idx_threads_product_id on public.threads(product_id);
create index idx_threads_last_message_at on public.threads(last_message_at desc);

create index idx_messages_thread_created on public.messages(thread_id, created_at);
create index idx_creative_versions_thread_created on public.creative_versions(thread_id, created_at desc);

create index idx_assets_brand_id on public.assets(brand_id);
create index idx_ai_runs_brand_created on public.ai_runs(brand_id, created_at desc);

create index idx_usage_events_brand_created on public.usage_events(brand_id, created_at desc);
create index idx_credit_ledger_brand_created on public.credit_ledger(brand_id, created_at desc);

create index idx_subscriptions_brand_id on public.subscriptions(brand_id);
create index idx_billing_invoices_brand_id on public.billing_invoices(brand_id, created_at desc);
```

---

# 19. `updated_at` Trigger

Use a shared trigger for mutable tables.

```sql
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
```

Apply to all tables that have `updated_at`.

---

# 20. RLS Strategy

## Rule

Every workspace-owned table must be protected by `brand_id`.

### Direct brand tables

Policy pattern:

```sql
using (
  exists (
    select 1
    from public.brand_members bm
    where bm.brand_id = brand_id
      and bm.user_id = auth.uid()
      and bm.status = 'active'
  )
)
```

### Admin-only writes

Use `role in ('owner', 'admin')`.

### Service-role only

Billing sync, Stripe webhooks, and system jobs run server-side only.

---

# 21. Storage Buckets

Recommended buckets:

```text
brand-assets
product-assets
competitor-ads
creative-assets
exports
imports
```

All private.

---

# 22. Final Relationship Map

```text
profiles
 └── brand_members
      └── brands
           ├── brand_profiles
           ├── brand_visual_identity
           ├── brand_settings
           ├── import_runs
           │    └── import_pages
           ├── products
           │    ├── product_benefits
           │    ├── product_asset_links
           │    └── icps
           ├── competitors
           │    ├── competitor_ads
           │    │    └── competitor_ad_asset_links
           │    ├── competitor_analysis_runs
           │    └── competitor_insights
           ├── templates
           ├── assets
           ├── threads
           │    ├── thread_context_snapshots
           │    ├── messages
           │    ├── creative_versions
           │    ├── creative_asset_links
           │    └── exports
           ├── ai_runs
           ├── billing_customers
           ├── subscriptions
           ├── billing_invoices
           ├── webhook_events
           ├── usage_events
           ├── credit_ledger
           ├── usage_monthly_rollups
           └── audit_logs
```

