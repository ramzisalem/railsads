-- 006: Products
-- Note: product_benefits are stored in products.attributes JSONB for MVP

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
