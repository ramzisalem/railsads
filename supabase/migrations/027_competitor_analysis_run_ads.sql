-- 027: Track which competitor ads each analysis run consumed.
--
-- This enables incremental analysis: when the user re-runs "Analyze ads"
-- we send only the ads that haven't been analyzed yet (per scope), and
-- merge results with the prior insight server-side.

create table if not exists public.competitor_analysis_run_ads (
  run_id uuid not null references public.competitor_analysis_runs(id) on delete cascade,
  ad_id uuid not null references public.competitor_ads(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (run_id, ad_id)
);

create index if not exists competitor_analysis_run_ads_ad_id_idx
  on public.competitor_analysis_run_ads (ad_id);

alter table public.competitor_analysis_run_ads enable row level security;

-- Membership is enforced transitively via the parent run's brand_id.
create policy "Members can view run ads"
  on public.competitor_analysis_run_ads for select
  using (
    exists (
      select 1
      from public.competitor_analysis_runs r
      join public.brand_members bm on bm.brand_id = r.brand_id
      where r.id = run_id
        and bm.user_id = auth.uid()
        and bm.status = 'active'
    )
  );

create policy "Members can manage run ads"
  on public.competitor_analysis_run_ads for all
  using (
    exists (
      select 1
      from public.competitor_analysis_runs r
      join public.brand_members bm on bm.brand_id = r.brand_id
      where r.id = run_id
        and bm.user_id = auth.uid()
        and bm.status = 'active'
    )
  );

-- Best-effort backfill so historical analyses don't make every existing
-- ad look "un-analyzed" the first time the new UI loads.
insert into public.competitor_analysis_run_ads (run_id, ad_id)
select r.id, a.id
from public.competitor_analysis_runs r
join public.competitor_ads a
  on a.competitor_id = r.competitor_id
  and a.created_at <= coalesce(r.completed_at, r.created_at)
where r.status = 'completed'
  and (r.product_id is null or a.mapped_product_id = r.product_id)
on conflict (run_id, ad_id) do nothing;
