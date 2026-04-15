-- 007: Ideal Customer Profiles

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
