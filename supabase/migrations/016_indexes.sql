-- 016: Performance indexes

create index idx_brand_members_brand_id on public.brand_members(brand_id);
create index idx_brand_members_user_id on public.brand_members(user_id);

create index idx_products_brand_id on public.products(brand_id);
create index idx_icps_brand_product on public.icps(brand_id, product_id);

create index idx_competitors_brand_id on public.competitors(brand_id);
create index idx_competitor_ads_competitor_id on public.competitor_ads(competitor_id);

create index idx_threads_brand_id on public.threads(brand_id);
create index idx_threads_product_id on public.threads(product_id);
create index idx_threads_last_message_at on public.threads(last_message_at desc);

create index idx_messages_thread_created on public.messages(thread_id, created_at);
create index idx_creative_versions_thread_created on public.creative_versions(thread_id, created_at desc);

create index idx_assets_brand_id on public.assets(brand_id);
create index idx_ai_runs_brand_created on public.ai_runs(brand_id, created_at desc);

create index idx_usage_events_brand_created on public.usage_events(brand_id, created_at desc);
create index idx_credit_ledger_brand_created on public.credit_ledger(brand_id, created_at desc);

create index idx_subscriptions_brand_id on public.subscriptions(brand_id);
create index idx_billing_invoices_brand_id on public.billing_invoices(brand_id, created_at desc);
