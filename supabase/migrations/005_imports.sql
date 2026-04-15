-- 005: Import system (website import runs + pages)

create table public.import_runs (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  source_type public.source_type not null,
  source_url text,
  status public.import_status not null default 'queued',
  pages_found integer default 0,
  model text,
  prompt_version text,
  result_summary jsonb,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.import_pages (
  id uuid primary key default gen_random_uuid(),
  import_run_id uuid not null references public.import_runs(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  page_url text not null,
  page_title text,
  content_storage_path text,
  extracted_payload jsonb,
  created_at timestamptz not null default now()
);
