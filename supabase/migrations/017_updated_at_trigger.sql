-- 017: Shared updated_at trigger applied to all mutable tables

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Apply to all tables with updated_at columns
create trigger set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.brands for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.brand_members for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.brand_settings for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.brand_profiles for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.brand_visual_identity for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.products for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.icps for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.competitors for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.competitor_ads for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.competitor_insights for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.templates for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.threads for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.plans for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.billing_customers for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.subscriptions for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.usage_monthly_rollups for each row execute function public.set_updated_at();
