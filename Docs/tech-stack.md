Technical Architecture
1. Architecture in one sentence
Build the MVP as a single TypeScript full-stack app using Next.js App Router for the app layer, Supabase for database/auth/storage, OpenAI for AI workflows, and Vercel for deployment and ops. This gives you one codebase, modern server-side capabilities, secure multi-tenant data, and a clean path to scale later without introducing unnecessary infrastructure early. Next.js App Router is built on modern React capabilities like Server Components and Suspense, Route Handlers live inside the app directory, Supabase bundles Postgres/Auth/Storage/Realtime, and Vercel supports deploy previews, cron, and observability. (Next.js)
2. Final stack
Frontend and app layer
Use Next.js (App Router) + React + TypeScript.
Why this is the right choice:
one app for both frontend and backend orchestration
server-rendered flows for workspace, products, competitors, and studio
Route Handlers for API endpoints
Server Actions for simple mutations from the UI
easy long-term maintainability in one language and one runtime
Next.js documents the App Router as the file-system router using Server Components, Suspense, and server-side features, and Route Handlers as custom request handlers in the app directory. (Next.js)
UI layer
Use Tailwind CSS + shadcn/ui.
Why:
fastest way to build a polished SaaS UI
consistent design system
easy to customize because you own the components
ideal for a chat-first interface with context panels, cards, dropdowns, sheets, and dialogs
Backend / BFF pattern
Keep backend logic inside the Next.js app for the MVP.
Use:
Server Actions for simple authenticated mutations like editing brand info, saving ICP changes, renaming a thread, updating context
Route Handlers for AI requests, streaming, uploads, exports, webhooks, cron endpoints, and long-running orchestration
This gives you a clean BFF pattern without creating a separate backend service too early.
Database / auth / storage
Use Supabase:
Postgres as the system of record
Supabase Auth for auth
Supabase Storage for files
RLS for authorization
Realtime only if needed later
Supabase documents Postgres/Auth/Storage/Realtime as core platform features, and Storage is designed to work with RLS-based access policies. (Supabase)
Hosting / deployment
Use Vercel.
Why:
best fit for Next.js
preview deployments
simple production deployment
cron jobs
observability
lightweight analytics
Vercel documents AI SDK, AI Gateway, Cron, and observability-related products as part of its platform ecosystem. (Vercel)
Observability and analytics
Use:
Sentry for application errors, traces, and logs
Vercel Observability later if needed
Vercel Web Analytics for lightweight product/traffic analytics
Testing and quality
Use:
Vitest for unit and integration tests
Playwright for end-to-end tests
ESLint + Prettier
Supabase CLI + SQL migrations
3. Core architectural rule
This is the rule the whole system should follow:
Supabase = source of truth
Next.js = app + orchestration layer
OpenAI = generation engine
Vercel = runtime + deploy
Storage = files and assets
Threads/messages/versions = Postgres

That separation is what keeps the system maintainable.
4. Repository structure
Use a single repository with one Next.js app.
apps/web
  app/
    (dashboard)/
    brand/
    products/
    products/[productId]/
    competitors/
    competitors/[competitorId]/
    studio/
    api/
      brand/import/
      icp/generate/
      competitors/analyze/
      creative/generate/
      creative/revise/
      exports/
      cron/
  components/
  features/
    brand/
    products/
    icp/
    competitors/
    studio/
    threads/
  lib/
    ai/
    db/
    auth/
    storage/
    telemetry/
    validators/
  schemas/
  tests/

supabase/
  migrations/
  seed.sql

This structure keeps product domains separate while staying in one app.
5. Backend service architecture
Inside the app, create a small internal service layer.
Recommended services:
brandImportService
icpService
competitorService
creativeService
creativeRevisionService
threadService
exportService

What each service does
brandImportService
fetches website HTML/content
extracts brand info, colors, products, messaging
saves normalized workspace data
icpService
generates ICPs for selected products
saves summaries and structured fields
supports regenerate/update flows
competitorService
stores competitor brands and references
analyzes competitor ads
extracts patterns and maps them to products
creativeService
generates initial ad outputs from context
returns structured blocks: hooks, copy, headlines, creative direction
creativeRevisionService
handles follow-up chat revisions
updates the active creative state
decides whether to use cheaper or premium model based on revision complexity
threadService
creates threads
restores context from threads
stores messages and creative versions
exportService
formats output for copy/download
handles image export and future export formats
6. Database architecture
Use Supabase Postgres as the primary database.
Core tables
users
brands
brand_members

brand_profiles
brand_visual_identity

products
product_images
product_benefits

icps

competitors
competitor_ads
competitor_insights
product_competitor_links

threads
messages
creative_versions
creative_assets
exports

What belongs where
brands
workspace root
brand_members
maps users to brands/workspaces
brand_profiles
tone, messaging, positioning
brand_visual_identity
colors, style tags, personality tags
products
product metadata linked to brand
icps
product-specific audience definitions
competitors
competitor brands per workspace
competitor_ads
uploaded screenshots, links, text references
competitor_insights
extracted patterns
product_competitor_links
maps competitor signals to specific products
threads
one creative workspace per idea/direction
messages
user and assistant conversation inside a thread
creative_versions
saved output states over time
creative_assets
metadata for generated images and other assets
Storage
Use Supabase Storage for:
imported product images
competitor ad screenshots
generated ad images
exported files
Supabase Storage is intended for files and works with RLS-based access control. (Supabase)
7. Auth, tenancy, and security
Use Supabase Auth for:
email/password
magic links
Google sign-in later if needed
Model multi-tenancy like this:
brands
brand_members
users
All business data should be scoped by brand_id.
Security model
Use Supabase Row Level Security from day one.
Every table that belongs to a workspace should be protected by RLS policies. Supabase explicitly documents RLS as the way to implement granular authorization in Postgres and warns that the service role key must never be exposed on the frontend because it bypasses RLS. (Supabase)
Rule:
anon key can be used in the client
service_role key stays server-side only
8. AI architecture
Split AI into three layers.
Layer 1: Prompt and schema layer
This is your IP.
Store in app code:
prompt templates
output schemas
validation rules
system prompt fragments
template definitions
angle and awareness enums
Layer 2: AI service layer
This is where your application logic lives.
Examples:
extractBrandFromWebsite()
generateICPs()
analyzeCompetitorAds()
generateCreative()
reviseCreativeThread()
generateThreadTitle()
Layer 3: Provider layer
Underneath, call the OpenAI Responses API and use Structured Outputs wherever the output must be deterministic and machine-readable.
The Responses API is OpenAI’s current interface for stateful, multimodal inputs and tool-capable flows, and Structured Outputs is designed to enforce schema-valid responses. (Vercel)
9. Model selection by feature
This is the final model map I would use.
Feature
Model
Reason
Website → Brand extraction
gpt-4.1-mini
structured extraction, low cost, good enough quality
Product extraction cleanup
gpt-4.1-mini
frequent, operational, not premium
ICP generation
gpt-4.1-mini
structured reasoning, cheap, fast
Competitor analysis
gpt-4.1-mini
good default for pattern extraction
Competitor deep analysis
gpt-4.1
only when richer reasoning is needed
Initial creative generation
gpt-4.1
highest-value output, quality matters most
Creative chat revisions
gpt-4.1-mini
keeps frequent iterations affordable
Major creative rewrites
gpt-4.1
better for significant reframing
Image generation / editing
gpt-image-1
recommended OpenAI image model
Thread title generation
gpt-4.1-mini
short low-cost task
Embeddings later
text-embedding-3-small
future retrieval/search

Final routing strategy
Premium lane
Use gpt-4.1 for:
initial creative generation
strategic rewrites
highest-value user-facing copy quality
Efficient lane
Use gpt-4.1-mini for:
website extraction
ICP generation
competitor pattern extraction
lightweight revisions
thread naming
metadata generation
Image lane
Use gpt-image-1 for:
initial visual generation
edits
refinements
variations
Retrieval lane later
Use text-embedding-3-small only when you add semantic retrieval.
10. Optional abstraction layer
If you want better streaming ergonomics and future provider flexibility, put the provider calls behind the Vercel AI SDK. Vercel describes the AI SDK as a TypeScript toolkit that abstracts model providers and supports rich AI-powered app UX. (Vercel)
Important:
keep your own service layer on top
do not let provider SDK details leak into your product logic
Later, if you need cross-provider routing, budgets, and failover, you can place provider traffic behind Vercel AI Gateway, which Vercel documents as a unified endpoint with budgets, usage monitoring, and fallbacks. (Vercel)
11. Why this architecture scales well
This scales because concerns are separated early without forcing infrastructure sprawl.
Why it scales
Next.js handles the UI and orchestration in one codebase. (Next.js)
Supabase gives you relational data, auth, storage, RLS, and later vector search without platform changes. (Supabase)
Vercel gives you deploy previews, cron, and future AI routing infrastructure without introducing ops burden too early. (Vercel)
OpenAI Responses API gives you a modern, schema-friendly interface for both generation and revision flows. (Vercel)
Why it stays maintainable
one language: TypeScript
one main codebase
clear service boundaries
database as the source of truth
files in storage, not embedded in relational records
product domains aligned with code domains
12. What not to use right now
Do not start with:
microservices
separate Python backend
Kafka / RabbitMQ
Kubernetes
custom auth
separate vector database
complex event-driven architecture
dedicated media service
These only become justified when you hit real pain around:
heavy async workloads
large job queues
multiple independently scaling services
advanced ML pipelines
For your current product, they would reduce maintainability, not improve it.
13. Scale path later
Phase 1 — now
Use:
one Next.js app
Supabase
OpenAI
Vercel
Phase 2 — when imports and generation get heavier
Add:
dedicated async job runner for long-running tasks
keep frontend unchanged
keep Supabase as source of truth
Phase 3 — when retrieval matters
Add:
embeddings with pgvector in Supabase
semantic retrieval for:
similar creatives
pattern reuse
brand memory search
Supabase supports pgvector as a Postgres extension and documents permission-aware retrieval patterns. (Supabase)
Phase 4 — when provider flexibility and spend controls matter
Add:
Vercel AI SDK for abstraction if not added already
Vercel AI Gateway for model routing, budgets, monitoring, and fallbacks. (Vercel)
14. Final recommendation
If I were locking this today, I would choose:
Next.js App Router
React + TypeScript
Tailwind CSS
shadcn/ui
Supabase Postgres
Supabase Auth
Supabase Storage
Supabase RLS
OpenAI Responses API
Structured Outputs
gpt-4.1-mini
gpt-4.1
gpt-image-1
text-embedding-3-small later
Vercel
Vercel Cron
Vercel AI SDK optional
Vercel AI Gateway later
Sentry
Vitest
Playwright
ESLint + Prettier
Supabase CLI + SQL migrations
15. Final condensed version to share
We should build the MVP as a single TypeScript full-stack app using Next.js App Router, Tailwind, and shadcn/ui on the frontend/app layer; Supabase Postgres/Auth/Storage with Row Level Security as the backend foundation; OpenAI Responses API with Structured Outputs for AI workflows and gpt-image-1 for image generation; and Vercel for deployment, preview environments, cron, and future AI routing. The app keeps business logic inside a small internal service layer, uses Supabase as the source of truth, and stores files in Storage while threads/messages/versions live in Postgres. Model routing should use gpt-4.1-mini for extraction, ICPs, competitor analysis, and lightweight revisions; gpt-4.1 for premium creative generation and major rewrites; and text-embedding-3-small only later when semantic retrieval is needed. This gives us the best balance of speed, maintainability, cost control, and a clean path to scale. (Next.js)
Next best step: turn this into a database schema + API/service map.

