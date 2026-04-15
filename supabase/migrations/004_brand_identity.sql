-- 004: Brand profiles (messaging/tone) + brand visual identity (colors/style)

create table public.brand_profiles (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null unique references public.brands(id) on delete cascade,
  description text,
  category text,
  positioning text,
  value_proposition text,
  messaging_notes text,
  tone_tags text[] not null default '{}',
  personality_tags text[] not null default '{}',
  do_rules text[] not null default '{}',
  dont_rules text[] not null default '{}',
  source public.source_type not null default 'manual',
  raw_import_payload jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Fills the gap identified in DB.md relationship map (section 22)
create table public.brand_visual_identity (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null unique references public.brands(id) on delete cascade,
  primary_color text,
  secondary_color text,
  accent_color text,
  style_tags text[] not null default '{}',
  visual_notes text,
  source public.source_type not null default 'manual',
  raw_import_payload jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
