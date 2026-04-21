import {
  extractInlineImageHints,
  extractJsonLdProducts,
  type JsonLdProductHint,
} from "@/lib/ai/website-visual-extract";
import { assertSafeImageFetchUrl } from "@/lib/onboarding/product-hero-image";

/**
 * Server-side scraper that pulls every plausible product image from a single
 * PDP HTML page. The result is fed into the vision picker, which chooses the
 * best clean pack-shot.
 */

export interface ImageCandidate {
  /** Resolved absolute https URL */
  url: string;
  /** Raw alt text (may help the picker disambiguate when vision is borderline) */
  alt: string | null;
  source: "jsonld" | "og" | "twitter" | "image_src" | "img";
  /** Heuristic prior — higher = more likely to be the hero pack-shot */
  priority: number;
}

const FETCH_TIMEOUT_MS = 8000;
const HTML_USER_AGENT =
  "Mozilla/5.0 (compatible; RailsAds/1.0; +https://railsads.com)";

/** ----- Helpers ---------------------------------------------------------- */

function metaContent(
  html: string,
  attr: "name" | "property",
  key: string
): string | null {
  const re = new RegExp(`<meta[^>]+${attr}=["']${key}["'][^>]*>`, "i");
  const tag = html.match(re)?.[0];
  if (!tag) return null;
  return tag.match(/content=["']([^"']+)["']/i)?.[1]?.trim() ?? null;
}

function linkRelHref(html: string, rel: string): string | null {
  const re = new RegExp(`<link[^>]+rel=["']${rel}["'][^>]*>`, "i");
  const tag = html.match(re)?.[0];
  if (!tag) return null;
  return tag.match(/href=["']([^"']+)["']/i)?.[1]?.trim() ?? null;
}

function resolveAgainst(base: string, raw: string): string | null {
  const r = raw.trim();
  if (!r) return null;
  if (r.startsWith("//")) return `https:${r}`;
  try {
    return new URL(r, base).href;
  } catch {
    return null;
  }
}

/**
 * Drop URLs we can statically tell are not a product photo (logos, payment
 * badges, social icons, hero/lifestyle banners, etc).
 */
function isObviouslyNotPackshot(url: string, alt: string | null): boolean {
  const path = url.split("?")[0].toLowerCase();
  const a = (alt ?? "").toLowerCase();

  if (
    /logo|favicon|sprite|payment|trustbadge|amex|visa|mastercard|paypal|klarna|stripe|apple-?pay|google-?pay|shop-?pay|stars?|rating|review|badge|icon|social|facebook|instagram|twitter|youtube|tiktok|pinterest/.test(
      path
    )
  ) {
    return true;
  }
  if (/logo|icon|badge|payment|reviews?|rating|stars?/.test(a)) return true;
  if (/banner|hero|lifestyle|model|cover/.test(path) && /people|model|lifestyle/.test(a)) {
    // Banner-ish AND alt mentions models — almost never the pack-shot we want
    return true;
  }
  if (path.endsWith(".svg")) return true; // Almost always decorative on PDPs
  if (path.endsWith(".gif")) return true; // Loaders / animated CTAs
  return false;
}

/** Strip Shopify-style query sizing / cache busting before dedupe */
function dedupeKey(url: string): string {
  return url.split("?")[0].toLowerCase();
}

/** ----- Public ----------------------------------------------------------- */

export async function fetchPdpHtml(
  url: string,
  signal?: AbortSignal
): Promise<string | null> {
  let safe: URL;
  try {
    safe = assertSafeImageFetchUrl(url);
  } catch {
    return null;
  }
  if (safe.protocol !== "http:" && safe.protocol !== "https:") return null;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  signal?.addEventListener("abort", () => ctrl.abort());

  try {
    const res = await fetch(safe.href, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": HTML_USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (ct && !ct.includes("text/html") && !ct.includes("xhtml")) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Pull every plausible product image from a PDP HTML page, ranked by source
 * (JSON-LD > og:image > twitter:image > image_src > <img>). Caller is expected
 * to filter further with a vision pass.
 */
export function parseProductImageCandidates(
  html: string,
  pageUrl: string,
  productName?: string | null
): ImageCandidate[] {
  const collected = new Map<string, ImageCandidate>();
  const push = (c: Omit<ImageCandidate, "url"> & { rawUrl: string }) => {
    const abs = resolveAgainst(pageUrl, c.rawUrl);
    if (!abs) return;
    if (!/^https?:\/\//i.test(abs)) return;
    if (isObviouslyNotPackshot(abs, c.alt)) return;
    const key = dedupeKey(abs);
    const existing = collected.get(key);
    if (!existing || c.priority > existing.priority) {
      collected.set(key, { url: abs, alt: c.alt, source: c.source, priority: c.priority });
    }
  };

  // 1) JSON-LD products on the PDP itself (highest signal).
  const jsonLd = extractJsonLdProducts(html);
  const matchedLd = pickMatchingJsonLdProduct(jsonLd, productName);
  if (matchedLd?.image) {
    push({
      rawUrl: matchedLd.image,
      alt: matchedLd.name,
      source: "jsonld",
      priority: 100,
    });
  }
  // Other JSON-LD products on the page (rare — collections / related)
  for (const p of jsonLd) {
    if (p === matchedLd || !p.image) continue;
    push({ rawUrl: p.image, alt: p.name, source: "jsonld", priority: 80 });
  }

  // 2) og:image, twitter:image, link rel=image_src (whole-page primary photo).
  const og = metaContent(html, "property", "og:image");
  if (og) push({ rawUrl: og, alt: null, source: "og", priority: 70 });
  const tw =
    metaContent(html, "name", "twitter:image") ||
    metaContent(html, "name", "twitter:image:src");
  if (tw) push({ rawUrl: tw, alt: null, source: "twitter", priority: 65 });
  const imgSrc = linkRelHref(html, "image_src");
  if (imgSrc)
    push({ rawUrl: imgSrc, alt: null, source: "image_src", priority: 60 });

  // 3) Inline <img> tags (lots of noise, but our static filter cuts most logos).
  const imgs = extractInlineImageHints(html, 60);
  const productSlug = (productName ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  for (const img of imgs) {
    const altText = img.alt ?? "";
    let priority = 30;
    if (productSlug && img.src.toLowerCase().includes(productSlug))
      priority += 10;
    if (
      productName &&
      altText &&
      altText.toLowerCase().includes(productName.toLowerCase().split(" ")[0])
    )
      priority += 5;
    push({ rawUrl: img.src, alt: altText || null, source: "img", priority });
  }

  return [...collected.values()]
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 12);
}

/**
 * HEAD each candidate to drop 404s, non-images, and tiny tracking-pixel
 * images. Best-effort — failures are silently dropped from the candidate set.
 */
export async function validateImageCandidates(
  candidates: ImageCandidate[],
  signal?: AbortSignal
): Promise<ImageCandidate[]> {
  const results = await Promise.all(
    candidates.map(async (c) => {
      try {
        assertSafeImageFetchUrl(c.url);
      } catch {
        return null;
      }
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 5000);
      signal?.addEventListener("abort", () => ctrl.abort());
      try {
        const res = await fetch(c.url, {
          method: "HEAD",
          signal: ctrl.signal,
          headers: { "User-Agent": HTML_USER_AGENT },
          redirect: "follow",
        });
        if (!res.ok) return null;
        const ct = res.headers.get("content-type")?.toLowerCase() ?? "";
        if (ct && !ct.startsWith("image/")) return null;
        if (ct.includes("svg") || ct.includes("gif")) return null;
        const len = parseInt(res.headers.get("content-length") ?? "0", 10);
        // Drop spacers and tiny logos (< 4 KB). Real product photos are way larger.
        if (len > 0 && len < 4 * 1024) return null;
        return c;
      } catch {
        return null;
      } finally {
        clearTimeout(t);
      }
    })
  );
  return results.filter((c): c is ImageCandidate => c !== null);
}

function pickMatchingJsonLdProduct(
  products: JsonLdProductHint[],
  name?: string | null
): JsonLdProductHint | null {
  if (!products.length) return null;
  if (!name) return products[0]; // PDP usually has a single Product node
  const target = name.toLowerCase();
  let best: { p: JsonLdProductHint; score: number } | null = null;
  for (const p of products) {
    const n = p.name.toLowerCase();
    let score = 0;
    if (n === target) score = 100;
    else if (n.includes(target) || target.includes(n)) score = 60;
    else {
      const overlap = target
        .split(/\s+/)
        .filter((w) => w.length > 2 && n.includes(w)).length;
      score = overlap * 10;
    }
    if (!best || score > best.score) best = { p, score };
  }
  return best && best.score > 0 ? best.p : products[0];
}
