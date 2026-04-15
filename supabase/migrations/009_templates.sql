-- 009: Templates (system + brand-specific)

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
