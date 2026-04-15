-- 010: Unified asset system + link tables

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

create table public.brand_asset_links (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  role public.asset_link_role not null default 'primary',
  sort_order integer not null default 0,
  unique (brand_id, asset_id)
);

create table public.product_asset_links (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  role public.asset_link_role not null default 'gallery',
  sort_order integer not null default 0,
  unique (product_id, asset_id)
);

create table public.competitor_ad_asset_links (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  competitor_ad_id uuid not null references public.competitor_ads(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  role public.asset_link_role not null default 'primary',
  unique (competitor_ad_id, asset_id)
);
