-- 012: AI run tracking

create table public.ai_runs (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  thread_id uuid references public.threads(id) on delete set null,
  message_id uuid references public.messages(id) on delete set null,
  service_type public.ai_service_type not null,
  status public.ai_run_status not null default 'queued',
  model text not null,
  prompt_version text,
  input_tokens integer,
  output_tokens integer,
  total_tokens integer,
  estimated_cost_usd numeric(10,4),
  credits_charged integer,
  latency_ms integer,
  request_payload jsonb,
  response_payload jsonb,
  error_message text,
  created_by uuid references public.profiles(id) on delete set null,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
