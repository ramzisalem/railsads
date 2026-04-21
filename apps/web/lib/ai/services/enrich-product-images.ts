import type { BrandImport } from "../schemas";
import type { JsonLdProductHint } from "../website-visual-extract";
import {
  fetchPdpHtml,
  parseProductImageCandidates,
  validateImageCandidates,
  type ImageCandidate,
} from "@/lib/onboarding/product-image-candidates";
import { resolveProductImageUrl } from "@/lib/onboarding/product-hero-image";
import {
  discoverPdpUrl,
  type DiscoveredPdp,
} from "@/lib/onboarding/discover-pdp-url";
import { extractProductPriceFromHtml } from "@/lib/onboarding/extract-product-price";
import { pickBestProductImage } from "./product-image-picker";

/**
 * Per-product post-processing of `BrandImport.products[].image_url`:
 *
 *   1. Resolve `product_url` against the website origin
 *   2. Fetch the PDP HTML (best effort; 8s timeout)
 *   3. Collect every plausible image (JSON-LD, og:image, twitter:image, <img>)
 *   4. HEAD-validate (drop 404s, non-images, tracking pixels, tiny logos)
 *   5. Vision-pick the cleanest pack-shot (single product, neutral bg, no people)
 *
 * Falls back to the LLM-supplied `image_url` if any step yields nothing useful,
 * so we never *regress* the existing behaviour — we only improve it.
 */

const PRODUCT_CONCURRENCY = 3;
const PER_PRODUCT_TIMEOUT_MS = 25_000;

export interface EnrichProductImagesOptions {
  /** Cap how many products we enrich (vision calls cost money) */
  maxProducts?: number;
  /** Raw homepage HTML — used to discover PDP URLs the LLM missed */
  homepageHtml?: string;
  /** JSON-LD product hints parsed from the homepage */
  jsonLdProducts?: JsonLdProductHint[];
}

export async function enrichProductImages(
  brand: BrandImport,
  websiteUrl: string,
  opts: EnrichProductImagesOptions = {}
): Promise<BrandImport> {
  if (!brand.products?.length) return brand;

  const origin = (() => {
    try {
      return new URL(
        websiteUrl.startsWith("http") ? websiteUrl : `https://${websiteUrl}`
      ).origin;
    } catch {
      return null;
    }
  })();
  if (!origin) return brand;

  const homepageHtml = opts.homepageHtml ?? "";
  const jsonLdProducts = opts.jsonLdProducts ?? [];

  const limit = Math.min(
    brand.products.length,
    opts.maxProducts ?? brand.products.length
  );
  const slots = brand.products.slice(0, limit);

  const enrichedSlots = await runWithConcurrency(
    slots,
    PRODUCT_CONCURRENCY,
    async (product) => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), PER_PRODUCT_TIMEOUT_MS);
      try {
        const result = await enrichOne(
          product,
          origin,
          { homepageHtml, jsonLdProducts },
          ctrl.signal
        );
        return {
          ...product,
          product_url: result.resolvedProductUrl ?? product.product_url ?? null,
          image_url: result.chosenImageUrl ?? product.image_url ?? null,
          // Prefer PDP-mined price (JSON-LD / OG meta) over the homepage LLM
          // guess — it's almost always more accurate. Keep the LLM value as
          // fallback when the PDP didn't surface one.
          price_text: result.priceText ?? product.price_text ?? null,
          price_currency:
            result.priceCurrency ?? product.price_currency ?? null,
        };
      } catch (err) {
        console.error(
          `enrichProductImages: "${product.name}" failed —`,
          err instanceof Error ? err.message : err
        );
        return product;
      } finally {
        clearTimeout(timer);
      }
    }
  );

  return {
    ...brand,
    products: [
      ...enrichedSlots,
      ...brand.products.slice(limit), // anything we didn't enrich passes through unchanged
    ],
  };
}

interface EnrichOneResult {
  resolvedProductUrl: string | null;
  chosenImageUrl: string | null;
  pdpSource: DiscoveredPdp["source"] | null;
  /** Display-ready price string mined from PDP HTML (e.g. "$129.00"), if any */
  priceText: string | null;
  /** ISO 4217 currency code from PDP structured data, if any */
  priceCurrency: string | null;
}

async function enrichOne(
  product: BrandImport["products"][number],
  origin: string,
  ctx: { homepageHtml: string; jsonLdProducts: JsonLdProductHint[] },
  signal: AbortSignal
): Promise<EnrichOneResult> {
  const discovered = discoverPdpUrl({
    productName: product.name,
    llmProductUrl: product.product_url,
    homepageHtml: ctx.homepageHtml,
    jsonLdProducts: ctx.jsonLdProducts,
    origin,
  });

  if (!discovered) {
    return {
      resolvedProductUrl: null,
      chosenImageUrl: null,
      pdpSource: null,
      priceText: null,
      priceCurrency: null,
    };
  }

  const html = await fetchPdpHtml(discovered.url, signal);
  if (!html) {
    // Shopify heuristic may have pointed at a non-existent slug — verify by
    // refusing to persist that URL if we couldn't load it.
    const resolvedProductUrl =
      discovered.source === "shopify-heuristic" ? null : discovered.url;
    return {
      resolvedProductUrl,
      chosenImageUrl: null,
      pdpSource: discovered.source,
      priceText: null,
      priceCurrency: null,
    };
  }

  // Mine the PDP for a structured price (JSON-LD / OG / Microdata). This is
  // ~free since we already have the HTML in memory for image scanning.
  const minedPrice = extractProductPriceFromHtml(html);

  const candidates = parseProductImageCandidates(html, discovered.url, product.name);
  if (!candidates.length) {
    return {
      resolvedProductUrl: discovered.url,
      chosenImageUrl: null,
      pdpSource: discovered.source,
      priceText: minedPrice?.priceText ?? null,
      priceCurrency: minedPrice?.priceCurrency ?? null,
    };
  }

  const validated = await validateImageCandidates(candidates, signal);
  if (!validated.length) {
    return {
      resolvedProductUrl: discovered.url,
      chosenImageUrl: null,
      pdpSource: discovered.source,
      priceText: minedPrice?.priceText ?? null,
      priceCurrency: minedPrice?.priceCurrency ?? null,
    };
  }

  // If the LLM already proposed an image and it survived validation, give it a
  // small priority bump so the picker isn't biased away from a perfectly good
  // pre-existing choice.
  if (product.image_url) {
    try {
      const llmAbs = resolveProductImageUrl(product.image_url, {
        siteOrigin: origin,
        productUrl: discovered.url,
      });
      const match = validated.find(
        (c) => c.url.split("?")[0] === llmAbs.split("?")[0]
      );
      if (match) match.priority = Math.max(match.priority, 95);
    } catch {
      /* ignore unresolvable LLM URL */
    }
  }

  validated.sort((a, b) => b.priority - a.priority);

  const pick = await pickBestProductImage({
    productName: product.name,
    productDescription: product.description ?? product.short_description,
    candidates: validated,
  });

  const chosenImageUrl = pick?.url ?? validated[0]?.url ?? null;

  return {
    resolvedProductUrl: discovered.url,
    chosenImageUrl,
    pdpSource: discovered.source,
    priceText: minedPrice?.priceText ?? null,
    priceCurrency: minedPrice?.priceCurrency ?? null,
  };
}

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, idx: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const launchers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (true) {
        const i = cursor++;
        if (i >= items.length) break;
        results[i] = await worker(items[i], i);
      }
    }
  );
  await Promise.all(launchers);
  return results;
}

// Re-export for convenience to callers that want to introspect candidates
export type { ImageCandidate };
