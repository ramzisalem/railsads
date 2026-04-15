-- 001: Extensions and Enum Types

create extension if not exists pgcrypto;
create extension if not exists citext;

create type public.brand_role as enum ('owner','admin','member');
create type public.member_status as enum ('invited','active','removed');
create type public.brand_status as enum ('active','paused','archived');
create type public.product_status as enum ('draft','active','archived');
create type public.competitor_status as enum ('active','archived');
create type public.thread_status as enum ('active','archived');
create type public.message_role as enum ('user','assistant','system');

create type public.awareness_level as enum (
  'unaware',
  'problem_aware',
  'solution_aware',
  'product_aware',
  'most_aware'
);

create type public.asset_kind as enum (
  'brand_logo',
  'brand_cover',
  'product_image',
  'competitor_ad',
  'generated_image',
  'reference_image',
  'export_file'
);

create type public.asset_link_role as enum (
  'primary',
  'gallery',
  'reference',
  'selected',
  'export'
);

create type public.source_type as enum (
  'manual',
  'website_import',
  'ai_generated',
  'upload',
  'link'
);

create type public.import_status as enum ('queued','running','completed','failed');
create type public.ai_run_status as enum ('queued','running','completed','failed');

create type public.ai_service_type as enum (
  'brand_import',
  'icp_generation',
  'competitor_analysis',
  'creative_generation',
  'creative_revision',
  'image_generation',
  'thread_title'
);

create type public.subscription_status as enum (
  'trialing','active','past_due','canceled','unpaid','incomplete'
);

create type public.credit_reason as enum (
  'monthly_grant','trial_grant','manual_adjustment',
  'usage_deduction','refund','bonus'
);

create type public.usage_event_type as enum (
  'website_import',
  'icp_generation',
  'competitor_analysis',
  'creative_generation',
  'creative_revision',
  'image_generation',
  'export'
);
