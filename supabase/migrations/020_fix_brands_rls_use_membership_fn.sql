-- 020: Fix brands SELECT/UPDATE RLS
--
-- Policies used EXISTS (subquery on brand_members). After 019, nested reads on
-- brand_members can still fail to "see" the membership row in that context, so
-- SELECT on brands returns zero rows even when brand_members is readable directly.
-- Use the same SECURITY DEFINER helpers as brand_members policies.

drop policy if exists "Brand members can view brands" on public.brands;
create policy "Brand members can view brands"
  on public.brands for select
  using (public.has_active_brand_membership(id));

drop policy if exists "Brand admins can update brands" on public.brands;
create policy "Brand admins can update brands"
  on public.brands for update
  using (public.has_active_brand_admin(id));
