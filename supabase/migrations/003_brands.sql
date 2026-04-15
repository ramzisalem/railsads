-- 003: Brands, brand_members, brand_invitations, brand_settings

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

create table public.brand_settings (
  brand_id uuid primary key references public.brands(id) on delete cascade,
  default_template_id uuid,
  default_awareness public.awareness_level,
  ui_preferences jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
