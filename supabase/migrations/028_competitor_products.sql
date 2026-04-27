-- 028: Competitor products + brand-product overlap links
--
-- Mirrors the public.products table but scoped to a competitor (the brand
-- doesn't own these — they're a snapshot of what the competitor sells).
-- Lets us run the same website-import pipeline on competitor sites and
-- link each competitor product to one or more of OUR products via
-- competitor_product_brand_links (the per-product "competes for" mapping
-- the existing per-competitor product_competitor_links is too coarse for).

create table if not exists public.competitor_products (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  competitor_id uuid not null references public.competitors(id) on delete cascade,
  name text not null,
  short_description text,
  description text,
  price_amount numeric(12,2),
  price_currency text default 'USD',
  product_url text,
  image_url text,
  attributes jsonb not null default '{}',
  source public.source_type not null default 'manual',
  raw_import_payload jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists competitor_products_competitor_id_idx
  on public.competitor_products (competitor_id)
  where deleted_at is null;

create index if not exists competitor_products_brand_id_idx
  on public.competitor_products (brand_id)
  where deleted_at is null;

-- Per-competitor-product overlap with our brand's products. Lets users say
-- "this competitor SKU competes for our PortableBlender" — finer-grained
-- than the existing product_competitor_links (competitor ↔ product) which
-- is at the whole-competitor level.
create table if not exists public.competitor_product_brand_links (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  competitor_product_id uuid not null references public.competitor_products(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  notes text,
  created_at timestamptz not null default now(),
  unique (competitor_product_id, product_id)
);

create index if not exists competitor_product_brand_links_product_id_idx
  on public.competitor_product_brand_links (product_id);

create index if not exists competitor_product_brand_links_competitor_product_id_idx
  on public.competitor_product_brand_links (competitor_product_id);

-- Keep updated_at in sync (matches the rest of the schema's convention)
create trigger set_updated_at
  before update on public.competitor_products
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------------
-- RLS: same brand-membership pattern as the rest of the workspace
-- ------------------------------------------------------------------

alter table public.competitor_products enable row level security;
alter table public.competitor_product_brand_links enable row level security;

create policy "Members can view competitor products"
  on public.competitor_products for select
  using (
    exists (
      select 1 from public.brand_members bm
      where bm.brand_id = competitor_products.brand_id
        and bm.user_id = auth.uid()
        and bm.status = 'active'
    )
  );

create policy "Members can manage competitor products"
  on public.competitor_products for all
  using (
    exists (
      select 1 from public.brand_members bm
      where bm.brand_id = competitor_products.brand_id
        and bm.user_id = auth.uid()
        and bm.status = 'active'
    )
  );

create policy "Members can view competitor product brand links"
  on public.competitor_product_brand_links for select
  using (
    exists (
      select 1 from public.brand_members bm
      where bm.brand_id = competitor_product_brand_links.brand_id
        and bm.user_id = auth.uid()
        and bm.status = 'active'
    )
  );

create policy "Members can manage competitor product brand links"
  on public.competitor_product_brand_links for all
  using (
    exists (
      select 1 from public.brand_members bm
      where bm.brand_id = competitor_product_brand_links.brand_id
        and bm.user_id = auth.uid()
        and bm.status = 'active'
    )
  );
