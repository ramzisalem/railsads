import type { JsonLdProductHint } from "@/lib/ai/website-visual-extract";

/**
 * Resolve a PDP URL for a product, in this order:
 *   1. `product.product_url` (from the LLM)
 *   2. JSON-LD product whose name best matches
 *   3. Homepage anchor whose visible text best matches the product name and
 *      whose href looks like a product detail page (/products/, /product/,
 *      /shop/, /p/, /items/, ?pid=, etc.)
 *   4. Shopify `/products/<slug>` heuristic (derived from the product name)
 *      — only when the site clearly uses Shopify
 *
 * Everything runs purely against the homepage HTML we already have, so it adds
 * no extra HTTP latency beyond what enrichment already does.
 */

const PDP_PATH_RE =
  /\/(?:products?|shop|p|items?|sku|goods|detail)\/[^\s"'?#]+/i;

export interface DiscoveredPdp {
  url: string;
  source: "llm" | "jsonld" | "anchor" | "shopify-heuristic";
}

export function resolveAgainst(origin: string, rawHref: string): string | null {
  const raw = rawHref.trim();
  if (!raw) return null;
  if (raw.startsWith("//")) return `https:${raw}`;
  try {
    return new URL(raw, `${origin}/`).href;
  } catch {
    return null;
  }
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

function nameMatchScore(productName: string, candidate: string): number {
  const a = productName.toLowerCase();
  const b = candidate.toLowerCase();
  if (!a || !b) return 0;
  if (a === b) return 100;
  if (b.includes(a)) return 80;
  if (a.includes(b)) return 60;
  const words = a.split(/\s+/).filter((w) => w.length > 2);
  if (!words.length) return 0;
  const hits = words.filter((w) => b.includes(w)).length;
  return Math.round((hits / words.length) * 50);
}

/** Pick the JSON-LD product whose `name` best matches. */
export function pdpFromJsonLd(
  productName: string,
  jsonLd: JsonLdProductHint[],
  origin: string
): DiscoveredPdp | null {
  if (!jsonLd.length) return null;
  let best: { hint: JsonLdProductHint; score: number } | null = null;
  for (const hint of jsonLd) {
    if (!hint.url) continue;
    const score = nameMatchScore(productName, hint.name);
    if (score < 40) continue;
    if (!best || score > best.score) best = { hint, score };
  }
  if (!best?.hint.url) return null;
  const abs = resolveAgainst(origin, best.hint.url);
  return abs ? { url: abs, source: "jsonld" } : null;
}

/**
 * Scan `<a href="…">visible text</a>` on the homepage for anchors that
 * (a) look like a PDP path and (b) match the product by name/slug.
 */
export function pdpFromHomepageAnchors(
  productName: string,
  html: string,
  origin: string
): DiscoveredPdp | null {
  const slug = slugify(productName);
  const words = productName
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);
  if (!slug && !words.length) return null;

  const anchors = html.matchAll(
    /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  );

  let best: { href: string; score: number } | null = null;
  for (const m of anchors) {
    const href = m[1].trim();
    if (!href) continue;
    // Skip protocol-relative or external links to other domains
    if (/^mailto:|^tel:|^javascript:/i.test(href)) continue;
    if (/^https?:\/\//i.test(href)) {
      try {
        if (new URL(href).origin !== origin) continue;
      } catch {
        continue;
      }
    }
    if (!PDP_PATH_RE.test(href)) continue;

    const visible = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const anchorText = visible.toLowerCase();

    let score = 0;
    if (slug && href.toLowerCase().includes(slug)) score += 70;
    if (anchorText && words.length) {
      const hits = words.filter((w) => anchorText.includes(w)).length;
      score += Math.round((hits / words.length) * 50);
    }
    // Small bonus for /products/ paths — the canonical e-commerce pattern
    if (/\/products?\//i.test(href)) score += 10;

    if (score < 50) continue;
    if (!best || score > best.score) best = { href, score };
  }

  if (!best) return null;
  const abs = resolveAgainst(origin, best.href);
  return abs ? { url: abs, source: "anchor" } : null;
}

/** Shopify stores ALWAYS expose `/products/<handle>` URLs. */
export function isShopifyLike(html: string): boolean {
  return (
    /cdn\.shopify\.com/i.test(html) ||
    /Shopify\.theme/.test(html) ||
    /<meta[^>]+shopify-digital-wallet/i.test(html)
  );
}

export function pdpFromShopifyHeuristic(
  productName: string,
  html: string,
  origin: string
): DiscoveredPdp | null {
  if (!isShopifyLike(html)) return null;
  const slug = slugify(productName);
  if (!slug) return null;
  return { url: `${origin}/products/${slug}`, source: "shopify-heuristic" };
}

export function discoverPdpUrl(opts: {
  productName: string;
  llmProductUrl?: string | null;
  homepageHtml: string;
  jsonLdProducts: JsonLdProductHint[];
  origin: string;
}): DiscoveredPdp | null {
  const { productName, llmProductUrl, homepageHtml, jsonLdProducts, origin } =
    opts;

  if (llmProductUrl?.trim()) {
    const abs = resolveAgainst(origin, llmProductUrl.trim());
    if (abs) return { url: abs, source: "llm" };
  }

  const fromJsonLd = pdpFromJsonLd(productName, jsonLdProducts, origin);
  if (fromJsonLd) return fromJsonLd;

  const fromAnchor = pdpFromHomepageAnchors(productName, homepageHtml, origin);
  if (fromAnchor) return fromAnchor;

  const shopify = pdpFromShopifyHeuristic(productName, homepageHtml, origin);
  if (shopify) return shopify;

  return null;
}
