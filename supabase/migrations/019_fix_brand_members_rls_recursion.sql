-- 019: Fix infinite RLS recursion on brand_members
--
-- Policies on brand_members used EXISTS (subquery on brand_members), which
-- re-entered RLS on the same table (e.g. when ai_runs policies checked membership).
-- Helpers run as definer and bypass RLS on brand_members while evaluating membership.

create or replace function public.has_active_brand_membership(
  p_brand_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.brand_members bm
    where bm.brand_id = p_brand_id
      and bm.user_id = p_user_id
      and bm.status = 'active'
  );
$$;

create or replace function public.has_active_brand_admin(
  p_brand_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.brand_members bm
    where bm.brand_id = p_brand_id
      and bm.user_id = p_user_id
      and bm.status = 'active'
      and bm.role in ('owner', 'admin')
  );
$$;

revoke all on function public.has_active_brand_membership(uuid, uuid) from public;
revoke all on function public.has_active_brand_admin(uuid, uuid) from public;

grant execute on function public.has_active_brand_membership(uuid, uuid) to authenticated, service_role;
grant execute on function public.has_active_brand_admin(uuid, uuid) to authenticated, service_role;

drop policy if exists "Brand members can view members" on public.brand_members;
drop policy if exists "Brand admins can manage members" on public.brand_members;

create policy "Brand members can view members"
  on public.brand_members for select
  using (public.has_active_brand_membership(brand_id));

create policy "Brand admins can manage members"
  on public.brand_members for all
  using (public.has_active_brand_admin(brand_id));
