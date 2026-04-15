-- 008: Competitors, ads, analysis runs, insights, product links

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

create table public.product_competitor_links (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  competitor_id uuid not null references public.competitors(id) on delete cascade,
  notes text,
  created_at timestamptz not null default now(),
  unique (product_id, competitor_id)
);

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
