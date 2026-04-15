-- 011: Creative Studio — threads, context snapshots, messages, versions, asset links, exports

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
