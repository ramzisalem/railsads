🧠 Pricing & Billing System
This system defines:
Plans
Usage model
Credits
Billing (Stripe)
Upgrade flows

Core principle
Sell outcomes, hide complexity, control cost internally

🎯 1. Pricing Overview

Plans
Starter → $79 / month
Pro → $119 / month
Enterprise → Custom

Credits
Starter → 2,500 credits / month
Pro → 5,000 credits / month
Enterprise → custom

User-facing abstraction
Credits are internal

Users see:
→ creatives per month
→ usage progress

🧩 2. Credit System

Mapping
Creative generation        → 15 credits
Image generation           → 25 credits
ICP generation             → 5 credits
Competitor analysis        → 10 credits
Website import             → 20 credits
Iteration                  → FREE

Rule
Charge for creation, not iteration

🧠 3. Plans Breakdown

🔵 Starter — $79
2,500 credits / month
≈ 150 creatives

1 Brand
Core features
Basic insights

🟣 Pro — $119 ⭐
5,000 credits / month
≈ 300 creatives

3 Brands
All features
Competitor insights
Priority generation

🟡 Enterprise — Custom
10,000+ credits
Unlimited brands
Custom features
Dedicated support

💳 4. Billing System (Stripe)

Architecture
Stripe = source of truth for billing
Supabase = source of truth for product usage

Entities
Stripe Customer
Stripe Subscription
Stripe Price (plan)
Stripe Webhooks

🧠 5. Stripe Setup

Products (Stripe Dashboard)

Starter
Product: Starter Plan
Price: $79/month
Recurring: monthly

Pro
Product: Pro Plan
Price: $119/month
Recurring: monthly

Enterprise
Custom pricing (manual or via Stripe)

Price IDs (important)
Store in your app:
const STRIPE_PRICE_IDS = {
 starter: "price_xxx",
 pro: "price_xxx",
}

🧩 6. Database Tables (Billing)

subscriptions
create table public.subscriptions (
 id uuid primary key default gen_random_uuid(),
 brand_id uuid not null references public.brands(id) on delete cascade,

 stripe_customer_id text not null,
 stripe_subscription_id text unique,

 plan text not null, -- starter, pro, enterprise
 status text not null, -- active, canceled, past_due

 current_period_start timestamptz,
 current_period_end timestamptz,

 cancel_at_period_end boolean default false,

 created_at timestamptz default now(),
 updated_at timestamptz default now()
);

usage_tracking
create table public.usage_tracking (
 id uuid primary key default gen_random_uuid(),
 brand_id uuid not null references public.brands(id) on delete cascade,

 month date not null,

 credits_used integer not null default 0,
 credits_limit integer not null,

 created_at timestamptz default now(),

 unique (brand_id, month)
);

usage_events (optional but powerful)
create table public.usage_events (
 id uuid primary key default gen_random_uuid(),

 brand_id uuid not null,
 type text not null, -- creative, image, icp

 credits integer not null,

 metadata jsonb,

 created_at timestamptz default now()
);

🔄 7. Stripe Webhooks (CRITICAL)

You must handle:

1. checkout.session.completed
User subscribed
→ create subscription in DB
→ assign credits

2. invoice.paid
New billing cycle
→ reset credits
→ update period

3. customer.subscription.updated
Plan change
→ update limits

4. customer.subscription.deleted
Cancel subscription
→ downgrade access

🧠 8. Credit Allocation Logic

On subscription start
Starter → 2,500 credits
Pro → 5,000 credits

On monthly renewal
Reset credits

Important rule
Credits do NOT roll over

🧠 9. Usage Flow

When user performs action:

Example: Generate creative
→ cost = 15 credits
→ subtract from usage_tracking
→ log in usage_events

If limit reached

Soft UX
"You’re close to your limit"

Hard stop
Upgrade required

🧠 10. Upgrade / Downgrade Flow

Upgrade
Immediate
New credits applied instantly (optional)

Downgrade
Apply at next billing cycle

🧠 12. Security Rules

NEVER trust frontend

Credits checked server-side only

Stripe validation
Use webhooks only
Verify signatures

🧠 13. UX Layer

What user sees
You’ve used 120 / 300 creatives

Optional
80% usage → warning

NEVER show
Raw credits
Tokens
Costs

🧠 14. Future Extensions

Add-ons
Extra credits pack

Team billing
Seats
Shared credits

Usage-based pricing (later)
Hybrid subscription + usage

🧾 Summary

Pricing:
Starter → $79
Pro → $119
Enterprise → custom

Credits:
Internal system

Billing:
Stripe subscriptions

Usage:
Tracked in Supabase

Key rules:
- Charge for generation
- Free iteration
- Hide complexity

