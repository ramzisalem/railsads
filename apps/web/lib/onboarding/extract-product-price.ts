/**
 * Best-effort price extraction from a Product Detail Page's raw HTML.
 *
 * Tried in priority order:
 *   1. JSON-LD  `Product` -> `offers.price` (+ `priceCurrency`)              [most reliable]
 *   2. OpenGraph meta:    `product:price:amount` + `product:price:currency`
 *   3. Microdata meta:    `itemprop="price"` + `itemprop="priceCurrency"`
 *   4. Shopify meta:      `<meta property="og:price:amount">` etc. (alias)
 *   5. JSON-LD  `Offer`   `price` (when not nested inside a Product node)
 *
 * Returns the cleanest user-facing string we can build (e.g. `$129.00`,
 * `€49`, `1,299 USD`) plus an ISO 4217 currency hint when available.
 *
 * Pure & sync — safe to call inside the existing image-enrichment pipeline.
 */

export interface ExtractedProductPrice {
  /** Human-readable price as shown to the user (e.g. "$99.00") */
  priceText: string;
  /** ISO 4217 currency code when known, else null */
  priceCurrency: string | null;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  CNY: "¥",
  KRW: "₩",
  INR: "₹",
  AUD: "A$",
  CAD: "C$",
  CHF: "CHF",
  SEK: "kr",
  NOK: "kr",
  DKK: "kr",
  PLN: "zł",
  BRL: "R$",
  MXN: "Mex$",
  TRY: "₺",
  RUB: "₽",
  ZAR: "R",
};

function symbolFor(code: string | null): string | null {
  if (!code) return null;
  return CURRENCY_SYMBOLS[code.toUpperCase()] ?? null;
}

/** Trim, drop empty, normalize whitespace; return null if useless. */
function clean(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = s.replace(/\s+/g, " ").trim();
  return t || null;
}

/** Build a display string from a numeric amount + ISO currency code. */
function formatPrice(amount: string, currency: string | null): string {
  const sym = symbolFor(currency);
  if (sym) return `${sym}${amount}`;
  if (currency) return `${amount} ${currency}`;
  return amount;
}

// ---------------------------------------------------------------------------
// JSON-LD walk
// ---------------------------------------------------------------------------

interface JsonNode {
  "@type"?: string | string[];
  "@graph"?: unknown[];
  offers?: unknown;
  price?: unknown;
  priceCurrency?: unknown;
  priceSpecification?: unknown;
  [k: string]: unknown;
}

function isType(node: JsonNode, target: string): boolean {
  const t = node["@type"];
  if (typeof t === "string") return t.toLowerCase() === target.toLowerCase();
  if (Array.isArray(t))
    return t.some(
      (x) => typeof x === "string" && x.toLowerCase() === target.toLowerCase()
    );
  return false;
}

function priceFromOffers(offers: unknown): ExtractedProductPrice | null {
  if (offers == null) return null;

  if (Array.isArray(offers)) {
    for (const o of offers) {
      const got = priceFromOffers(o);
      if (got) return got;
    }
    return null;
  }

  if (typeof offers !== "object") return null;
  const o = offers as JsonNode;

  // Direct `price`
  const direct = clean(typeof o.price === "string" ? o.price : String(o.price ?? ""));
  if (direct) {
    const currency =
      clean(typeof o.priceCurrency === "string" ? o.priceCurrency : null);
    return {
      priceText: formatPrice(direct, currency),
      priceCurrency: currency ? currency.toUpperCase() : null,
    };
  }

  // Nested `priceSpecification`
  if (o.priceSpecification) {
    const got = priceFromOffers(o.priceSpecification);
    if (got) return got;
  }

  return null;
}

function walkJsonLdForPrice(node: unknown, depth = 0): ExtractedProductPrice | null {
  if (depth > 6 || node == null) return null;

  if (Array.isArray(node)) {
    for (const it of node) {
      const got = walkJsonLdForPrice(it, depth + 1);
      if (got) return got;
    }
    return null;
  }

  if (typeof node !== "object") return null;
  const obj = node as JsonNode;

  // Prefer Product.offers, then any Offer, then recurse into @graph etc.
  if (isType(obj, "Product") && obj.offers) {
    const p = priceFromOffers(obj.offers);
    if (p) return p;
  }
  if (isType(obj, "Offer")) {
    const p = priceFromOffers(obj);
    if (p) return p;
  }

  if (Array.isArray(obj["@graph"])) {
    const got = walkJsonLdForPrice(obj["@graph"], depth + 1);
    if (got) return got;
  }

  // Last-ditch recursion through unknown keys.
  for (const key of Object.keys(obj)) {
    if (key === "@type" || key === "@graph" || key === "offers") continue;
    const got = walkJsonLdForPrice(obj[key], depth + 1);
    if (got) return got;
  }

  return null;
}

function extractFromJsonLd(html: string): ExtractedProductPrice | null {
  const scripts = html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  );

  for (const m of scripts) {
    const raw = m[1].trim();
    if (!raw) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    const got = walkJsonLdForPrice(parsed);
    if (got) return got;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Meta tag extraction (OpenGraph / Microdata / Shopify)
// ---------------------------------------------------------------------------

function metaContent(html: string, attr: "property" | "name" | "itemprop", key: string): string | null {
  const re = new RegExp(
    `<meta[^>]+\\b${attr}=["']${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]*>`,
    "i"
  );
  const tag = html.match(re)?.[0];
  if (!tag) return null;
  const content = tag.match(/\bcontent=["']([^"']+)["']/i)?.[1];
  return clean(content);
}

function extractFromMeta(html: string): ExtractedProductPrice | null {
  // OpenGraph product (Facebook)
  const ogAmount =
    metaContent(html, "property", "product:price:amount") ??
    metaContent(html, "property", "og:price:amount");
  const ogCurrency =
    metaContent(html, "property", "product:price:currency") ??
    metaContent(html, "property", "og:price:currency");
  if (ogAmount) {
    return {
      priceText: formatPrice(ogAmount, ogCurrency),
      priceCurrency: ogCurrency ? ogCurrency.toUpperCase() : null,
    };
  }

  // Microdata
  const microAmount = metaContent(html, "itemprop", "price");
  const microCurrency = metaContent(html, "itemprop", "priceCurrency");
  if (microAmount) {
    return {
      priceText: formatPrice(microAmount, microCurrency),
      priceCurrency: microCurrency ? microCurrency.toUpperCase() : null,
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the best price we can mine from a PDP's HTML, or null when nothing
 * confidently looks like a price. Quiet on errors — failure is "no price".
 */
export function extractProductPriceFromHtml(
  html: string
): ExtractedProductPrice | null {
  if (!html) return null;
  return extractFromJsonLd(html) ?? extractFromMeta(html) ?? null;
}
