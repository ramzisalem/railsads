-- 018: Row Level Security policies
-- Pattern: all workspace-scoped tables require active brand membership

alter table public.profiles enable row level security;
alter table public.brands enable row level security;
alter table public.brand_members enable row level security;
alter table public.brand_invitations enable row level security;
alter table public.brand_settings enable row level security;
alter table public.brand_profiles enable row level security;
alter table public.brand_visual_identity enable row level security;
alter table public.import_runs enable row level security;
alter table public.import_pages enable row level security;
alter table public.products enable row level security;
alter table public.icps enable row level security;
alter table public.competitors enable row level security;
alter table public.product_competitor_links enable row level security;
alter table public.competitor_ads enable row level security;
alter table public.competitor_analysis_runs enable row level security;
alter table public.competitor_insights enable row level security;
alter table public.templates enable row level security;
alter table public.assets enable row level security;
alter table public.brand_asset_links enable row level security;
alter table public.product_asset_links enable row level security;
alter table public.competitor_ad_asset_links enable row level security;
alter table public.threads enable row level security;
alter table public.thread_context_snapshots enable row level security;
alter table public.messages enable row level security;
alter table public.creative_versions enable row level security;
alter table public.creative_asset_links enable row level security;
alter table public.exports enable row level security;
alter table public.ai_runs enable row level security;
alter table public.plans enable row level security;
alter table public.billing_customers enable row level security;
alter table public.subscriptions enable row level security;
alter table public.billing_invoices enable row level security;
alter table public.webhook_events enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.usage_events enable row level security;
alter table public.usage_monthly_rollups enable row level security;
alter table public.audit_logs enable row level security;

-- ============================================================
-- Helper: check active brand membership
-- ============================================================

-- Profiles: users can read/update their own profile
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Brands: members can view their brands
create policy "Brand members can view brands"
  on public.brands for select
  using (
    exists (
      select 1 from public.brand_members bm
      where bm.brand_id = id
        and bm.user_id = auth.uid()
        and bm.status = 'active'
    )
  );

create policy "Users can create brands"
  on public.brands for insert
  with check (auth.uid() = created_by);

create policy "Brand admins can update brands"
  on public.brands for update
  using (
    exists (
      select 1 from public.brand_members bm
      where bm.brand_id = id
        and bm.user_id = auth.uid()
        and bm.status = 'active'
        and bm.role in ('owner', 'admin')
    )
  );

-- Brand members: members can see their co-members
create policy "Brand members can view members"
  on public.brand_members for select
  using (
    exists (
      select 1 from public.brand_members bm
      where bm.brand_id = brand_id
        and bm.user_id = auth.uid()
        and bm.status = 'active'
    )
  );

create policy "Brand admins can manage members"
  on public.brand_members for all
  using (
    exists (
      select 1 from public.brand_members bm
      where bm.brand_id = brand_id
        and bm.user_id = auth.uid()
        and bm.status = 'active'
        and bm.role in ('owner', 'admin')
    )
  );

-- ============================================================
-- Generic workspace-scoped policies (brand_id based)
-- Applied to: brand_settings, brand_profiles, brand_visual_identity,
-- import_runs, import_pages, products, icps, competitors, etc.
-- ============================================================

-- Macro: for each workspace table, members can read, admins can write
-- We create explicit policies for each table for clarity.

-- brand_settings
create policy "Members can view brand settings"
  on public.brand_settings for select
  using (exists (select 1 from public.brand_members bm where bm.brand_id = brand_id and bm.user_id = auth.uid() and bm.status = 'active'));

create policy "Admins can manage brand settings"
  on public.brand_settings for all
  using (exists (select 1 from public.brand_members bm where bm.brand_id = brand_id and bm.user_id = auth.uid() and bm.status = 'active' and bm.role in ('owner','admin')));

-- brand_profiles
create policy "Members can view brand profiles"
  on public.brand_profiles for select
  using (exists (select 1 from public.brand_members bm where bm.brand_id = brand_id and bm.user_id = auth.uid() and bm.status = 'active'));

create policy "Members can manage brand profiles"
  on public.brand_profiles for all
  using (exists (select 1 from public.brand_members bm where bm.brand_id = brand_id and bm.user_id = auth.uid() and bm.status = 'active'));

-- brand_visual_identity
create policy "Members can view brand visual identity"
  on public.brand_visual_identity for select
  using (exists (select 1 from public.brand_members bm where bm.brand_id = brand_id and bm.user_id = auth.uid() and bm.status = 'active'));

create policy "Members can manage brand visual identity"
  on public.brand_visual_identity for all
  using (exists (select 1 from public.brand_members bm where bm.brand_id = brand_id and bm.user_id = auth.uid() and bm.status = 'active'));

-- import_runs
create policy "Members can view import runs"
  on public.import_runs for select
  using (exists (select 1 from public.brand_members bm where bm.brand_id = brand_id and bm.user_id = auth.uid() and bm.status = 'active'));

create policy "Members can manage import runs"
  on public.import_runs for all
  using (exists (select 1 from public.brand_members bm where bm.brand_id = brand_id and bm.user_id = auth.uid() and bm.status = 'active'));

-- import_pages
create policy "Members can view import pages"
  on public.import_pages for select
  using (exists (select 1 from public.brand_members bm where bm.brand_id = brand_id and bm.user_id = auth.uid() and bm.status = 'active'));

create policy "Members can manage import pages"
  on public.import_pages for all
  using (exists (select 1 from public.brand_members bm where bm.brand_id = brand_id and bm.user_id = auth.uid() and bm.status = 'active'));

-- products
create policy "Members can view products"
  on public.products for select
  using (exists (select 1 from public.brand_members bm where bm.brand_id = brand_id and bm.user_id = auth.uid() and bm.status = 'active'));

create policy "Members can manage products"
  on public.products for all
  using (exists (select 1 from public.brand_members bm where bm.brand_id = brand_id and bm.user_id = auth.uid() and bm.status = 'active'));

-- icps
create policy "Members can view icps"
  on public.icps for select
  using (exists (select 1 from public.brand_members bm where bm.brand_id = brand_id and bm.user_id = auth.uid() and bm.status = 'active'));

create policy "Members can manage icps"
  on public.icps for all
  using (exists (select 1 from public.brand_members bm where bm.brand_id = brand_id and bm.user_id = auth.uid() and bm.status = 'active'));

-- competitors
create policy "Members can view competitors"
  on public.competitors for select
  using (exists (select 1 from public.brand_members bm where bm.brand_id = brand_id and bm.user_id = auth.uid() and bm.status = 'active'));

create policy "Members can manage competitors"
  on public.competitors for all
  using (exists (select 1 from public.brand_members bm where bm.brand_id = brand_id and bm.user_id = auth.uid() and bm.status = 'active'));

-- product_competitor_links
create policy "Members can view product competitor links"
  on public.product_competitor_links for select
  using (exists (select 1 from public.brand_members bm where bm.brand_id = brand_id and bm.user_id = auth.uid() and bm.status = 'active'));

create policy "Members can manage product competitor links"
  on public.product_competitor_links for all
  using (exists (select 1 from public.brand_members bm where bm.brand_id = brand_id and bm.user_id = auth.uid() and bm.status = 'active'));

-- competitor_ads
create policy "Members can view competitor ads"
  on public.competitor_ads for select
  using (exists (select 1 from public.brand_members bm where bm.brand_id = brand_id and bm.user_id = auth.uid() and bm.status = 'active'));

create policy "Members can manage competitor ads"
  on public.competitor_ads for all
  using (exists (select 1 from public.brand_members bm where bm.brand_id = brand_id and bm.user_id = auth.uid() and bm.status = 'active'));

-- competitor_analysis_runs
create policy "Members can view competitor analysis runs"
  on public.competitor_analysis_runs for select
  using (exists (select 1 from public.brand_members bm where bm.brand_id = brand_id and bm.user_id = auth.uid() and bm.status = 'active'));

create policy "Members can manage competitor analysis runs"
  on public.competitor_analysis_runs for all
  using (exists (select 1 from public.brand_members bm where bm.brand_id = brand_id and bm.user_id = auth.uid() and bm.status = 'active'));

-- competitor_insights
create policy "Members can view competitor insights"
  on public.competitor_insights for select
  using (exists (select 1 from public.brand_members bm where bm.brand_id = brand_id and bm.user_id = auth.uid() and bm.status = 'active'));

create policy "Members can manage competitor insights"
  on public.competitor_insights for all
  using (exists (select 1 from public.brand_members bm where bm.brand_id = brand_id and bm.user_id = auth.uid() and bm.status = 'active'));

-- templates (system templates readable by all, brand templates by members)
create policy "Anyone can view system templates"
  on public.templates for select
  using (is_system = true or exists (select 1 from public.brand_members bm where bm.brand_id = brand_id and bm.user_id = auth.uid() and bm.status = 'active'));

create policy "Members can manage brand templates"
  on public.templates for all
  using (exists (select 1 from public.brand_members bm where bm.brand_id = brand_id and bm.user_id = auth.uid() and bm.status = 'active'));

-- assets
create policy "Members can view assets"
  on public.assets for select
  using (exists (select 1 from public.brand_members bm where bm.brand_id = brand_id and bm.user_id = auth.uid() and bm.status = 'active'));

create policy "Members can manage assets"
  on public.assets for all
  using (exists (select 1 from public.brand_members bm where bm.brand_id = brand_id and bm.user_id = auth.uid() and bm.status = 'active'));

-- brand_asset_links
create policy "Members can view brand asset links"
  on public.brand_asset_links for select
  using (exists (select 1 from public.brand_members bm where bm.brand_id = brand_id and bm.user_id = auth.uid() and bm.status = 'active'));

create policy "Members can manage brand asset links"
  on public.brand_asset_links for all
  using (exists (select 1 from public.brand_members bm where bm.brand_id = brand_id and bm.user_id = auth.uid() and bm.status = 'active'));

-- product_asset_links
create policy "Members can view product asset links"
  on public.product_asset_links for select
  using (exists (select 1 from public.brand_members bm where bm.brand_id = brand_id and bm.user_id = auth.uid() and bm.status = 'active'));

create policy "Members can manage product asset links"
  on public.product_asset_links for all
  using (exists (select 1 from public.brand_members bm where bm.brand_id = brand_id and bm.user_id = auth.uid() and bm.status = 'active'));

-- competitor_ad_asset_links
create policy "Members can view competitor ad asset links"
  on public.competitor_ad_asset_links for select
  using (exists (select 1 from public.brand_members bm where bm.brand_id = brand_id and bm.user_id = auth.uid() and bm.status = 'active'));

create policy "Members can manage competitor ad asset links"
  on public.competitor_ad_asset_links for all
  using (exists (select 1 from public.brand_members bm where bm.brand_id = brand_id and bm.user_id = auth.uid() and bm.status = 'active'));

-- threads
create policy "Members can view threads"
  on public.threads for select
  using (exists (select 1 from public.brand_members bm where bm.brand_id = brand_id and bm.user_id = auth.uid() and bm.status = 'active'));

create policy "Members can manage threads"
  on public.threads for all
  using (exists (select 1 from public.brand_members bm where bm.brand_id = brand_id and bm.user_id = auth.uid() and bm.status = 'active'));

-- thread_context_snapshots
create policy "Members can view thread context snapshots"
  on public.thread_context_snapshots for select
  using (exists (select 1 from public.brand_members bm where bm.brand_id = brand_id and bm.user_id = auth.uid() and bm.status = 'active'));

create policy "Members can manage thread context snapshots"
  on public.thread_context_snapshots for all
  using (exists (select 1 from public.brand_members bm where bm.brand_id = brand_id and bm.user_id = auth.uid() and bm.status = 'active'));

-- messages
create policy "Members can view messages"
  on public.messages for select
  using (exists (select 1 from public.brand_members bm where bm.brand_id = brand_id and bm.user_id = auth.uid() and bm.status = 'active'));

create policy "Members can manage messages"
  on public.messages for all
  using (exists (select 1 from public.brand_members bm where bm.brand_id = brand_id and bm.user_id = auth.uid() and bm.status = 'active'));

-- creative_versions
create policy "Members can view creative versions"
  on public.creative_versions for select
  using (exists (select 1 from public.brand_members bm where bm.brand_id = brand_id and bm.user_id = auth.uid() and bm.status = 'active'));

create policy "Members can manage creative versions"
  on public.creative_versions for all
  using (exists (select 1 from public.brand_members bm where bm.brand_id = brand_id and bm.user_id = auth.uid() and bm.status = 'active'));

-- creative_asset_links
create policy "Members can view creative asset links"
  on public.creative_asset_links for select
  using (exists (select 1 from public.brand_members bm where bm.brand_id = brand_id and bm.user_id = auth.uid() and bm.status = 'active'));

create policy "Members can manage creative asset links"
  on public.creative_asset_links for all
  using (exists (select 1 from public.brand_members bm where bm.brand_id = brand_id and bm.user_id = auth.uid() and bm.status = 'active'));

-- exports
create policy "Members can view exports"
  on public.exports for select
  using (exists (select 1 from public.brand_members bm where bm.brand_id = brand_id and bm.user_id = auth.uid() and bm.status = 'active'));

create policy "Members can manage exports"
  on public.exports for all
  using (exists (select 1 from public.brand_members bm where bm.brand_id = brand_id and bm.user_id = auth.uid() and bm.status = 'active'));

-- ai_runs
create policy "Members can view ai runs"
  on public.ai_runs for select
  using (exists (select 1 from public.brand_members bm where bm.brand_id = brand_id and bm.user_id = auth.uid() and bm.status = 'active'));

create policy "Members can manage ai runs"
  on public.ai_runs for all
  using (exists (select 1 from public.brand_members bm where bm.brand_id = brand_id and bm.user_id = auth.uid() and bm.status = 'active'));

-- plans: public read for all, no client writes
create policy "Anyone can view active plans"
  on public.plans for select
  using (is_active = true and is_public = true);

-- billing_customers, subscriptions, invoices: service-role only for writes
-- Members can view their own billing data
create policy "Members can view billing customer"
  on public.billing_customers for select
  using (exists (select 1 from public.brand_members bm where bm.brand_id = brand_id and bm.user_id = auth.uid() and bm.status = 'active'));

create policy "Members can view subscriptions"
  on public.subscriptions for select
  using (exists (select 1 from public.brand_members bm where bm.brand_id = brand_id and bm.user_id = auth.uid() and bm.status = 'active'));

create policy "Members can view billing invoices"
  on public.billing_invoices for select
  using (exists (select 1 from public.brand_members bm where bm.brand_id = brand_id and bm.user_id = auth.uid() and bm.status = 'active'));

-- webhook_events: service-role only (no client policies)

-- credit_ledger
create policy "Members can view credit ledger"
  on public.credit_ledger for select
  using (exists (select 1 from public.brand_members bm where bm.brand_id = brand_id and bm.user_id = auth.uid() and bm.status = 'active'));

-- usage_events
create policy "Members can view usage events"
  on public.usage_events for select
  using (exists (select 1 from public.brand_members bm where bm.brand_id = brand_id and bm.user_id = auth.uid() and bm.status = 'active'));

-- usage_monthly_rollups
create policy "Members can view usage rollups"
  on public.usage_monthly_rollups for select
  using (exists (select 1 from public.brand_members bm where bm.brand_id = brand_id and bm.user_id = auth.uid() and bm.status = 'active'));

-- audit_logs
create policy "Admins can view audit logs"
  on public.audit_logs for select
  using (exists (select 1 from public.brand_members bm where bm.brand_id = brand_id and bm.user_id = auth.uid() and bm.status = 'active' and bm.role in ('owner','admin')));

-- brand_invitations
create policy "Members can view invitations"
  on public.brand_invitations for select
  using (exists (select 1 from public.brand_members bm where bm.brand_id = brand_id and bm.user_id = auth.uid() and bm.status = 'active'));

create policy "Admins can manage invitations"
  on public.brand_invitations for all
  using (exists (select 1 from public.brand_members bm where bm.brand_id = brand_id and bm.user_id = auth.uid() and bm.status = 'active' and bm.role in ('owner','admin')));
