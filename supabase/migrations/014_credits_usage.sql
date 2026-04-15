-- 014: Credits & usage — immutable ledger, events, monthly rollups

create table public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  usage_event_id uuid,
  reason public.credit_reason not null,
  delta integer not null,
  period_start date,
  period_end date,
  reference_type text,
  reference_id uuid,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

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
