# RailsAds — Marketing Site

A static, SEO-optimised marketing site for RailsAds — your AI ads creative
strategist. Built with plain HTML, CSS and a tiny vanilla JS sprinkle — no
framework, no build step.

## Why static

- Sub-second first paint (no hydration)
- Crawlable by every search engine, social scraper and link previewer
- Zero runtime cost; can be hosted on any CDN or static bucket
- Easy to ship copy / design changes without touching the app

## Structure

```
apps/marketing/
├── index.html         # Landing page (hero, features, how-it-works, pricing teaser, FAQ, CTA)
├── pricing.html       # Dedicated pricing page with comparison table & credit breakdown
├── features.html      # Deep-dive on the six pillars (Brand, Products, ICPs, Competitors, Studio, Threads)
├── 404.html           # Branded "page not found"
├── robots.txt         # Search engine directives
├── sitemap.xml        # Sitemap for crawlers
├── README.md
└── assets/
    ├── styles.css     # Single stylesheet (design tokens + components, light/dark)
    ├── site.js        # Theme toggle, mobile menu, scroll-reveal, smooth-scroll, year stamp
    ├── favicon.svg    # Brand mark
    └── og.svg         # 1200×630 Open Graph image
```

## Design system (1-minute tour)

- **Brand**: warm beige (`#F5F3EF`) base, orange (`#FF6A00`) action, sage (`#9FB5AE`) calm.
- **Type**: Playfair Display for headings (serif, editorial), Inter for body & UI.
- **Tokens**: every color, radius, shadow lives as a CSS custom property in `:root`.
  Dark mode is just `[data-theme="dark"]` overrides.
- **Motion**: subtle fade-up on scroll via `IntersectionObserver`. Honors
  `prefers-reduced-motion`.

To extend, add a new section in HTML and reuse existing components (`.feature-card`,
`.plan`, `.cta-banner`, `.steps`, `.faq`, etc.).

## SEO checklist (already wired)

- Per-page `<title>`, `<meta description>`, `<link rel="canonical">`
- Open Graph + Twitter card on every page
- Structured data: `Organization`, `SoftwareApplication`, `Product` (JSON-LD)
- Semantic HTML (`<header>`, `<main>`, `<section>`, `<article>`, `<nav>`, `<footer>`)
- `robots.txt` + `sitemap.xml`
- Theme-color + viewport meta + `apple-touch-icon`
- Skip-to-content link, focus-visible styles, sufficient contrast

## Deployment

### Option 1 — Vercel / Netlify / Cloudflare Pages (recommended)

Point the host at `apps/marketing/` as the project root. No build command needed.
Set the publish directory to the same folder. Add a redirect for the SPA-style 404:

**Vercel** (`vercel.json` at the root of `apps/marketing/`):

```json
{
  "cleanUrls": true,
  "trailingSlash": false,
  "errorPage": "/404.html"
}
```

**Netlify** (`_redirects`):

```
/*    /404.html   404
```

### Option 2 — Cloudflare R2 / S3 + CDN

Upload the folder, set `index.html` as the index document and `404.html` as the
error document.

### Option 3 — Same host as the Next.js app

If you want `railsads.com` to serve the marketing site and `app.railsads.com` for
the dashboard, deploy this folder as the apex host and point auth links at the
app. Update the absolute URLs (`/signup`, `/login`, `/pricing`) in the HTML to
absolute `https://app.railsads.com/...` paths if the two apps live on different
hosts.

## Local preview

```bash
cd apps/marketing
python3 -m http.server 4000
# or
npx serve .
```

Then open <http://localhost:4000>.

## What to update when content changes

- Pricing copy: `index.html` (pricing teaser) **and** `pricing.html` (full).
- Brand voice: every page — keep it direct, calm, no hype.
- Domain: search-and-replace `railsads.com` if you launch under a different host.
- Open Graph image: regenerate `assets/og.svg` (it's a hand-written SVG).

## Brand voice reminders (from `Docs/brand.md`)

✅ "Generate 3 new hooks" — direct, verb-led
✅ "Try a problem-focused angle" — actionable
❌ "Let's create something amazing!" — too chatty
❌ "I'm here to help you 😊" — over-friendly

Short sentences. No fluff. No jargon. No hype.
