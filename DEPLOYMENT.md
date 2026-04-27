# RailsAds — Deployment Guide

Production deployment checklist for RailsAds on Vercel + Supabase + Stripe.

This monorepo ships **two** deployable apps:

| App | Path | Stack | Recommended domain |
|---|---|---|---|
| Dashboard / API | `apps/web` | Next.js 16 | `app.railsads.com` |
| Marketing site | `apps/marketing` | Static HTML / CSS / JS | `railsads.com` (apex) + `www.railsads.com` |

The recommendation is **two separate Vercel projects** in the same Git repository.
Each project has its own Root Directory, its own `vercel.json`, its own domain,
and only redeploys when its folder changes.

---

## Prerequisites

- Vercel account with a team/personal scope
- Supabase account (production project created)
- Stripe account (live mode enabled)
- Sentry account (project created)
- OpenAI API key with billing enabled
- Custom domain (optional but recommended)

---

## 1. Supabase Production Setup

### 1.1 Create a production project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Create a new project in your preferred region (e.g., `us-east-1` to match Vercel `iad1`)
3. Note down:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **Anon (public) key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **Service role key** → `SUPABASE_SERVICE_ROLE_KEY`

### 1.2 Run migrations

```bash
# Link to your production project
supabase link --project-ref <your-project-ref>

# Push all migrations
supabase db push
```

The 18 migration files in `supabase/migrations/` will create all tables, RLS policies, indexes, triggers, and enums.

### 1.3 Configure Auth

In Supabase Dashboard → Authentication → Settings:

1. **Site URL**: Set to your production URL (e.g., `https://app.railsads.com`)
2. **Redirect URLs**: Add:
   - `https://app.railsads.com/auth/callback`
   - `https://app.railsads.com/login`
3. **Email templates**: Customize confirmation and password reset emails with your branding
4. **Rate limiting**: Keep defaults (sensible for production)

### 1.4 Configure Storage

Verify that storage buckets were created by migrations:

- `product-images` (public)
- `competitor-ads` (public)
- `creative-assets` (public)
- `exports` (private)

If not, create them in Supabase Dashboard → Storage.

### 1.5 Seed data (optional)

```bash
# Only if you need the plans table seeded
supabase db execute --file supabase/seed.sql
```

---

## 2. Stripe Production Setup

### 2.1 Create products and prices

In [Stripe Dashboard](https://dashboard.stripe.com) (live mode):

1. Create product **Starter Plan** → Price: $79/month, recurring
2. Create product **Pro Plan** → Price: $119/month, recurring

Note the **Price IDs** (`price_...`) for each.

### 2.2 Create webhook endpoint

In Stripe Dashboard → Developers → Webhooks:

1. **Endpoint URL**: `https://app.railsads.com/api/billing/webhook`
2. **Events to send**:
   - `checkout.session.completed`
   - `invoice.paid`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
3. Note the **Signing secret** (`whsec_...`) → `STRIPE_WEBHOOK_SECRET`

### 2.3 Customer portal

In Stripe Dashboard → Settings → Customer portal:

1. Enable the customer portal
2. Configure allowed actions (cancel, update payment method)
3. Add your branding

---

## 3. Sentry Setup

1. Create a Next.js project in [sentry.io](https://sentry.io)
2. Note down:
   - **DSN** → `NEXT_PUBLIC_SENTRY_DSN`
   - **Org slug** → `SENTRY_ORG`
   - **Project slug** → `SENTRY_PROJECT`
3. Create an auth token → `SENTRY_AUTH_TOKEN` (for source map uploads)

---

## 4. Vercel Deployment — App (`apps/web`)

### 4.1 Import project

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import the GitHub repository
3. **Project name**: `railsads-web`
4. **Root Directory**: `apps/web`
5. **Framework Preset**: Next.js (auto-detected)
6. **Build Command**: `npm run build`
7. **Install Command**: `npm install`

> The `vercel.json` at the repo root configures this project (regions, headers, cron jobs).
> When Vercel detects a project with Root Directory = `apps/web`, it picks up that file.

### 4.2 Set environment variables

In Vercel Dashboard → Project → Settings → Environment Variables, add:

| Variable | Value | Environments |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | `https://app.railsads.com` | Production |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxx.supabase.co` | All |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` | All |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | All |
| `OPENAI_API_KEY` | `sk-...` | All |
| `STRIPE_SECRET_KEY` | `sk_live_...` | Production |
| `STRIPE_SECRET_KEY` | `sk_test_...` | Preview, Development |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | Production |
| `STRIPE_PRICE_STARTER` | `price_...` | Production |
| `STRIPE_PRICE_PRO` | `price_...` | Production |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_live_...` | Production |
| `NEXT_PUBLIC_SENTRY_DSN` | `https://xxx@xxx.ingest.us.sentry.io/xxx` | All |
| `SENTRY_ORG` | `your-org` | All |
| `SENTRY_PROJECT` | `railsads-web` | All |
| `SENTRY_AUTH_TOKEN` | `sntrys_...` | All |
| `CRON_SECRET` | (auto-generated by Vercel) | Production |

> **Important**: Use test keys for Preview/Development environments, live keys for Production only.

### 4.3 Deploy

```bash
# Push to main to trigger production deploy
git push origin main
```

Or deploy manually:

```bash
npx vercel --prod
```

### 4.4 Verify deployment

After deployment:

1. **Health check**: `curl https://app.railsads.com/api/health`
2. **Auth flow**: Sign up → confirm email → land on onboarding
3. **Stripe checkout**: Start a subscription → verify webhook fires
4. **Cron jobs**: Check Vercel Dashboard → Cron Jobs tab

---

## 5. Custom Domain (DNS)

### 5.1 Add domain in Vercel

1. Vercel Dashboard → Project → Settings → Domains
2. Add `app.railsads.com` (or your domain)
3. Follow Vercel's instructions to add DNS records:
   - **CNAME**: `app` → `cname.vercel-dns.com`
   - Or **A record**: `@` → Vercel IP (for apex domains)

### 5.2 SSL

Vercel automatically provisions and renews SSL certificates via Let's Encrypt.

### 5.3 Update references

After domain is live, update:

1. **Supabase Auth** → Site URL and redirect URLs
2. **Stripe webhook** → Update endpoint URL if using new domain
3. **`NEXT_PUBLIC_APP_URL`** env var in Vercel

---

## 5b. Vercel Deployment — Marketing site (`apps/marketing`)

The marketing site is plain HTML / CSS / JS — no build step, no framework.
Deploy it as its own Vercel project so it can live on the apex domain
(`railsads.com`) while the app stays at `app.railsads.com`.

### 5b.1 Update auth links to the app subdomain

Marketing CTAs (`Start free`, `Log in`) currently use relative paths like
`/signup` and `/login`. Once the app lives at `app.railsads.com`, those need
to be absolute. From the repo root, run a one-time replace:

```bash
cd apps/marketing
for f in *.html; do
  # Match href="/signup", href="/login", and href="/signup?plan=..."
  sed -i '' \
    -e 's|href="/signup|href="https://app.railsads.com/signup|g' \
    -e 's|href="/login|href="https://app.railsads.com/login|g' \
    "$f"
done
```

Internal links (`/pricing.html`, `/features.html`, `#faq`) stay relative — they're
served by the marketing project itself.

> If you'd rather host the app on the apex and the marketing on `www`, swap the
> domains below and skip this step.

### 5b.2 Import project

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import the **same** GitHub repository
3. **Project name**: `railsads-marketing`
4. **Root Directory**: `apps/marketing`
5. **Framework Preset**: Other (no preset) — it's a static site
6. **Build Command**: leave empty
7. **Output Directory**: `.` (the marketing folder itself)
8. **Install Command**: leave empty

`apps/marketing/vercel.json` ships with:
- `cleanUrls: true` so `/pricing` works alongside `/pricing.html`
- HSTS / X-Frame-Options / X-Content-Type-Options / Referrer-Policy / Permissions-Policy
- Long-lived cache headers on `/assets/*`
- Permanent redirect `/index.html → /`

### 5b.3 No environment variables needed

The marketing site has zero runtime dependencies. No keys, no env vars.

### 5b.4 Skip rebuilds when the app changes

In **Project → Settings → Git → Ignored Build Step**, paste:

```bash
git diff --quiet HEAD^ HEAD ./apps/marketing
```

This makes `railsads-marketing` only rebuild when files inside `apps/marketing`
change. Apply the equivalent (`./apps/web`) to the `railsads-web` project so
the two don't ping-pong on every push.

### 5b.5 Domains

In **Project → Settings → Domains** for `railsads-marketing`, add:
- `railsads.com` (apex — DNS A record to `76.76.21.21` per Vercel's instructions)
- `www.railsads.com` (CNAME to `cname.vercel-dns.com`)

In **Project → Settings → Domains** for `railsads-web`:
- `app.railsads.com` (CNAME to `cname.vercel-dns.com`)

Vercel issues SSL certificates automatically.

### 5b.6 Verify

After deploys finish:

```bash
curl -I https://railsads.com/
curl -I https://railsads.com/pricing
curl -I https://app.railsads.com/login
```

Each should return `200`. The marketing site's CTAs should send the browser to
`https://app.railsads.com/signup`.

---

## 5c. Alternative: single Vercel project with rewrites

If you'd rather serve everything from `railsads.com` (no app subdomain), you can
add a Next.js middleware rewrite in `apps/web` that proxies the marketing HTML
into the app's `public/` directory at build time. This keeps SEO clean but
couples the two deploys. **Not recommended for most teams** — separate projects
let designers ship marketing copy without touching the dashboard.

---

## 6. Cron Jobs

Defined in `vercel.json` and automatically registered on deploy:

| Cron | Schedule | Purpose |
|---|---|---|
| `/api/cron/usage-reconcile` | Daily at 3 AM UTC | Recalculates usage rollups from credit ledger |
| `/api/cron/subscription-sync` | 1st of month, 4 AM UTC | Syncs subscription status with Stripe |

Both endpoints are protected by `CRON_SECRET` (auto-set by Vercel).

---

## 7. Security Checklist

- [x] `SUPABASE_SERVICE_ROLE_KEY` is never exposed to the client
- [x] All API routes validate authentication
- [x] Stripe webhooks verify signature
- [x] Cron endpoints verify `CRON_SECRET`
- [x] RLS policies on all tables
- [x] HSTS, CSP, X-Frame-Options, X-Content-Type-Options headers
- [x] `poweredByHeader: false` in Next.js config
- [x] No secrets in `.env.local.example`

---

## 8. Monitoring

### Sentry
- Error tracking for client, server, and edge runtimes
- Performance traces at 10% sample rate
- Session replays on errors

### Health endpoint
- `GET /api/health` returns `200` (healthy) or `503` (degraded)
- Includes database connectivity check and latency

### Vercel
- Build logs and function logs in Vercel Dashboard
- Cron execution logs under Cron Jobs tab

---

## 9. Rollback

If a deployment causes issues:

1. **Instant rollback**: Vercel Dashboard → Deployments → select previous → Promote to Production
2. **Database**: Supabase migrations are forward-only; write a new migration to revert schema changes

---

## 10. Environment Matrix

| Environment | Supabase | Stripe | OpenAI | Sentry |
|---|---|---|---|---|
| **Local** | Local (`supabase start`) | Test keys | Real key | Optional |
| **Preview** | Staging project | Test keys | Real key | Enabled |
| **Production** | Production project | Live keys | Real key | Enabled |
