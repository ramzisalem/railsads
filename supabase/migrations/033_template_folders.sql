-- 033: Template folders + per-brand template overrides.
--
-- Brands can now group templates (both system + their own uploads) into
-- named folders, and "delete" a system template for their brand without
-- touching the shared catalog. Two new tables back this:
--
--   template_folders         - named buckets scoped to a brand.
--   brand_template_overrides - per (brand, template) row storing the
--                              folder placement and a `hidden` flag. When
--                              no row exists the template lives in the
--                              default "Unsorted" bucket, visible.
--
-- We use a single overrides table (instead of putting folder_id on the
-- templates row for brand-owned ones) so system templates and brand
-- templates are placed/hidden through the exact same mechanism — the
-- Studio picker and the AI layer only need one lookup to resolve
-- effective folder + visibility.

create table if not exists public.template_folders (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, name)
);

create index if not exists template_folders_brand_id_idx
  on public.template_folders(brand_id);

create table if not exists public.brand_template_overrides (
  brand_id uuid not null references public.brands(id) on delete cascade,
  template_id uuid not null references public.templates(id) on delete cascade,
  folder_id uuid references public.template_folders(id) on delete set null,
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (brand_id, template_id)
);

create index if not exists brand_template_overrides_folder_idx
  on public.brand_template_overrides(folder_id);

comment on table public.template_folders is
  'Per-brand folders for grouping templates in the Studio picker.';
comment on table public.brand_template_overrides is
  'Per-(brand, template) placement + visibility override. Used so system templates (brand_id = null on templates) can still be foldered or hidden for a specific brand.';

-- Shared updated_at trigger so rename/move timestamps stay accurate.
drop trigger if exists set_updated_at on public.template_folders;
create trigger set_updated_at
  before update on public.template_folders
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.brand_template_overrides;
create trigger set_updated_at
  before update on public.brand_template_overrides
  for each row execute function public.set_updated_at();

-- ============================================================
-- RLS
-- ============================================================

alter table public.template_folders enable row level security;
alter table public.brand_template_overrides enable row level security;

drop policy if exists "Members can view template folders" on public.template_folders;
create policy "Members can view template folders"
  on public.template_folders for select
  using (
    exists (
      select 1 from public.brand_members bm
      where bm.brand_id = template_folders.brand_id
        and bm.user_id = auth.uid()
        and bm.status = 'active'
    )
  );

drop policy if exists "Members can manage template folders" on public.template_folders;
create policy "Members can manage template folders"
  on public.template_folders for all
  using (
    exists (
      select 1 from public.brand_members bm
      where bm.brand_id = template_folders.brand_id
        and bm.user_id = auth.uid()
        and bm.status = 'active'
    )
  )
  with check (
    exists (
      select 1 from public.brand_members bm
      where bm.brand_id = template_folders.brand_id
        and bm.user_id = auth.uid()
        and bm.status = 'active'
    )
  );

drop policy if exists "Members can view template overrides" on public.brand_template_overrides;
create policy "Members can view template overrides"
  on public.brand_template_overrides for select
  using (
    exists (
      select 1 from public.brand_members bm
      where bm.brand_id = brand_template_overrides.brand_id
        and bm.user_id = auth.uid()
        and bm.status = 'active'
    )
  );

drop policy if exists "Members can manage template overrides" on public.brand_template_overrides;
create policy "Members can manage template overrides"
  on public.brand_template_overrides for all
  using (
    exists (
      select 1 from public.brand_members bm
      where bm.brand_id = brand_template_overrides.brand_id
        and bm.user_id = auth.uid()
        and bm.status = 'active'
    )
  )
  with check (
    exists (
      select 1 from public.brand_members bm
      where bm.brand_id = brand_template_overrides.brand_id
        and bm.user_id = auth.uid()
        and bm.status = 'active'
    )
  );
