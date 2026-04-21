import type { BrandImport } from "./schemas";

// ---------------------------------------------------------------------------
// Color extraction — hex, rgb(), rgba(), hsl(), hsla(), and CSS-variable
// triplets (Shopify 2.0 pattern: `--color-…: 255, 122, 82`). The latter is the
// dominant pattern on modern Shopify/OS 2.0 themes, so skipping it means we
// miss most brand colors on those stores.
// ---------------------------------------------------------------------------

const HEX_RE = /#(?:[0-9a-fA-F]{3}){1,2}\b/g;
const RGB_FN_RE = /rgba?\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})(?:\s*[,/]\s*[\d.]+%?)?\s*\)/gi;
const HSL_FN_RE = /hsla?\(\s*([-\d.]+)(?:deg)?\s*[, ]\s*([\d.]+)%\s*[, ]\s*([\d.]+)%(?:\s*[,/]\s*[\d.]+%?)?\s*\)/gi;
// Matches:  --color-foo: 255, 122, 82   /   --brand: 255 122 82 / 0.8
const CSS_VAR_TRIPLET_RE =
  /--[a-z0-9-]*(?:color|bg|background|fg|foreground|brand|accent|scheme|surface|text|primary|secondary|tertiary|neutral)[a-z0-9-]*\s*:\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})(?:\s*[,/]\s*[\d.]+%?)?/gi;

function clamp255(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function rgbToHex(r: number, g: number, b: number): string {
  const to2 = (n: number) => clamp255(n).toString(16).padStart(2, "0");
  return `#${to2(r)}${to2(g)}${to2(b)}`;
}

function hslToHex(h: number, s: number, l: number): string {
  // h in deg, s/l in 0-100
  const sa = Math.min(100, Math.max(0, s)) / 100;
  const la = Math.min(100, Math.max(0, l)) / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sa * Math.min(la, 1 - la);
  const f = (n: number) =>
    la - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return rgbToHex(f(0) * 255, f(8) * 255, f(4) * 255);
}

function normalizeHex(raw: string): string | null {
  const s = raw.trim().toLowerCase();
  if (!s.startsWith("#")) return null;
  if (s.length === 4) {
    const r = s[1];
    const g = s[2];
    const b = s[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  if (s.length === 7 || s.length === 9) return s.slice(0, 7);
  return null;
}

function isLowSignalHex(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max < 20 && min < 20) return true;
  if (min > 248 && max > 250) return true;
  if (max - min < 10) return true; // grays
  return false;
}

interface RankedColor {
  hex: string;
  count: number;
  firstIndex: number;
}

function collectColors(text: string): RankedColor[] {
  const counts = new Map<string, RankedColor>();
  const record = (hex: string, idx: number) => {
    const n = normalizeHex(hex);
    if (!n) return;
    if (isLowSignalHex(n)) return;
    const existing = counts.get(n);
    if (existing) existing.count += 1;
    else counts.set(n, { hex: n, count: 1, firstIndex: idx });
  };

  for (const m of text.matchAll(HEX_RE)) record(m[0], m.index ?? 0);

  for (const m of text.matchAll(RGB_FN_RE)) {
    record(rgbToHex(+m[1], +m[2], +m[3]), m.index ?? 0);
  }

  for (const m of text.matchAll(CSS_VAR_TRIPLET_RE)) {
    record(rgbToHex(+m[1], +m[2], +m[3]), m.index ?? 0);
  }

  for (const m of text.matchAll(HSL_FN_RE)) {
    const h = parseFloat(m[1]);
    const s = parseFloat(m[2]);
    const l = parseFloat(m[3]);
    if (!Number.isFinite(h) || !Number.isFinite(s) || !Number.isFinite(l))
      continue;
    record(hslToHex(h, s, l), m.index ?? 0);
  }

  return [...counts.values()].sort(
    (a, b) => b.count - a.count || a.firstIndex - b.firstIndex
  );
}

/**
 * Filter out near-duplicates (< ~ΔE 12 in linear RGB space) so two nearly
 * identical oranges don't both end up in the palette. Keeps the one with the
 * higher count.
 */
function dedupePerceptually(
  colors: RankedColor[],
  threshold = 18
): RankedColor[] {
  const out: RankedColor[] = [];
  for (const c of colors) {
    const [r1, g1, b1] = [
      parseInt(c.hex.slice(1, 3), 16),
      parseInt(c.hex.slice(3, 5), 16),
      parseInt(c.hex.slice(5, 7), 16),
    ];
    const isNearDup = out.some((o) => {
      const [r2, g2, b2] = [
        parseInt(o.hex.slice(1, 3), 16),
        parseInt(o.hex.slice(3, 5), 16),
        parseInt(o.hex.slice(5, 7), 16),
      ];
      return (
        Math.abs(r1 - r2) < threshold &&
        Math.abs(g1 - g2) < threshold &&
        Math.abs(b1 - b2) < threshold
      );
    });
    if (!isNearDup) out.push(c);
  }
  return out;
}

export function extractPalette(text: string, cap: number): string[] {
  return dedupePerceptually(collectColors(text))
    .slice(0, cap)
    .map((c) => c.hex);
}

/**
 * Back-compat — same signature as before, returns distinct hexes.
 * @deprecated prefer {@link extractPalette}
 */
function uniqueHexes(text: string, cap: number): string[] {
  return extractPalette(text, cap);
}

function metaContent(html: string, attr: "name" | "property", key: string): string | null {
  const re = new RegExp(
    `<meta[^>]+${attr}=["']${key}["'][^>]*>`,
    "i"
  );
  const tag = html.match(re)?.[0];
  if (!tag) return null;
  const c = tag.match(/content=["']([^"']+)["']/i);
  const v = c?.[1]?.trim();
  return v || null;
}

function extractStyleAndInlineCss(html: string): string {
  const styleBlocks = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)]
    .map((m) => m[1])
    .join("\n");
  const inlineStyles = [...html.matchAll(/\sstyle=["']([^"']+)["']/gi)]
    .map((m) => m[1])
    .join("\n");
  return `${styleBlocks}\n${inlineStyles}`;
}

// ---------------------------------------------------------------------------
// JSON-LD product extraction
// ---------------------------------------------------------------------------

export interface JsonLdProductHint {
  name: string;
  image: string | null;
  url: string | null;
  description?: string | null;
}

interface JsonLdNode {
  "@type"?: string | string[];
  "@graph"?: unknown[];
  name?: unknown;
  image?: unknown;
  url?: unknown;
  description?: unknown;
  itemListElement?: unknown[];
  item?: unknown;
  [k: string]: unknown;
}

function asString(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return v.trim();
  return null;
}

function firstImage(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === "string") return v.trim() || null;
  if (Array.isArray(v)) {
    for (const it of v) {
      const s = firstImage(it);
      if (s) return s;
    }
    return null;
  }
  if (typeof v === "object" && v !== null) {
    const obj = v as Record<string, unknown>;
    return asString(obj.url) ?? asString(obj.contentUrl) ?? null;
  }
  return null;
}

function nodeMatchesType(node: JsonLdNode, target: string): boolean {
  const t = node["@type"];
  if (!t) return false;
  if (typeof t === "string") return t.toLowerCase() === target.toLowerCase();
  if (Array.isArray(t))
    return t.some(
      (x) => typeof x === "string" && x.toLowerCase() === target.toLowerCase()
    );
  return false;
}

function walkJsonLd(
  node: unknown,
  visit: (n: JsonLdNode) => void,
  depth = 0
): void {
  if (depth > 6 || node == null) return;
  if (Array.isArray(node)) {
    for (const it of node) walkJsonLd(it, visit, depth + 1);
    return;
  }
  if (typeof node !== "object") return;
  const obj = node as JsonLdNode;
  visit(obj);
  if (Array.isArray(obj["@graph"])) walkJsonLd(obj["@graph"], visit, depth + 1);
  if (Array.isArray(obj.itemListElement))
    walkJsonLd(obj.itemListElement, visit, depth + 1);
  if (obj.item) walkJsonLd(obj.item, visit, depth + 1);
}

export function extractJsonLdProducts(html: string): JsonLdProductHint[] {
  const out: JsonLdProductHint[] = [];
  const seen = new Set<string>();

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

    walkJsonLd(parsed, (node) => {
      if (!nodeMatchesType(node, "Product")) return;
      const name = asString(node.name);
      if (!name) return;
      const image = firstImage(node.image);
      const url = asString(node.url);
      const description = asString(node.description);
      const key = `${name.toLowerCase()}::${image ?? ""}::${url ?? ""}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ name, image, url, description });
    });
  }

  return out.slice(0, 32);
}

// ---------------------------------------------------------------------------
// <img> hint extraction
// ---------------------------------------------------------------------------

export interface InlineImageHint {
  src: string;
  alt: string | null;
}

const IMG_TAG_RE = /<img\b([^>]*)>/gi;
const ATTR_SRC_RE = /\b(?:src|data-src|data-original)=["']([^"']+)["']/i;
const ATTR_SRCSET_RE = /\b(?:srcset|data-srcset)=["']([^"']+)["']/i;
const ATTR_ALT_RE = /\balt=["']([^"']*)["']/i;

function pickFromSrcset(srcset: string): string | null {
  // Largest width wins for hero pictures
  const parts = srcset
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  let best: { url: string; w: number } | null = null;
  for (const p of parts) {
    const [url, sizeRaw] = p.split(/\s+/);
    if (!url) continue;
    const w = sizeRaw && sizeRaw.endsWith("w") ? parseInt(sizeRaw, 10) : 0;
    if (!best || w > best.w) best = { url, w };
  }
  return best?.url ?? null;
}

function isLikelyTrackingPixel(src: string, alt: string | null): boolean {
  const s = src.toLowerCase();
  if (/[?&](utm_|gtm|pixel|analytics)/.test(s)) return true;
  if (/(\b1x1\b|spacer|blank|transparent|placeholder)/.test(s)) return true;
  if (s.endsWith(".svg") && (alt == null || alt === "")) {
    // Most decorative icons are SVG with empty alt — not product photos
    return true;
  }
  return false;
}

export function extractInlineImageHints(
  html: string,
  cap: number
): InlineImageHint[] {
  const out: InlineImageHint[] = [];
  const seen = new Set<string>();
  for (const m of html.matchAll(IMG_TAG_RE)) {
    const attrs = m[1];
    const src =
      attrs.match(ATTR_SRC_RE)?.[1] ||
      (attrs.match(ATTR_SRCSET_RE)?.[1]
        ? pickFromSrcset(attrs.match(ATTR_SRCSET_RE)![1])
        : null);
    if (!src) continue;
    const alt = attrs.match(ATTR_ALT_RE)?.[1]?.trim() || null;
    if (isLikelyTrackingPixel(src, alt)) continue;
    if (seen.has(src)) continue;
    seen.add(src);
    out.push({ src, alt });
    if (out.length >= cap) break;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface WebsiteVisualExtract {
  /** Extra context appended to the brand-import prompt */
  hintBlock: string;
  /** When the model returns null colors, prefer these (meta + CSS palette) */
  colorFallbacks: {
    primary: string | null;
    secondary: string | null;
    accent: string | null;
    /** Full ranked, de-duplicated palette (up to ~12 colors) */
    palette: string[];
  };
  /** JSON-LD product hints (for downstream image enrichment if needed) */
  jsonLdProducts: JsonLdProductHint[];
}

/**
 * Derive color hints, JSON-LD products, and a short machine-readable block from
 * raw HTML (before scripts/styles are stripped for the text-only crawl).
 */
export function extractWebsiteVisualData(html: string): WebsiteVisualExtract {
  const theme =
    metaContent(html, "name", "theme-color") ||
    metaContent(html, "name", "msapplication-TileColor");
  const ogImage = metaContent(html, "property", "og:image");
  const twitterImage =
    metaContent(html, "name", "twitter:image") ||
    metaContent(html, "name", "twitter:image:src");

  const cssBlob = extractStyleAndInlineCss(html);
  // Scan more of the document — modern Shopify/OS2.0 themes emit most of their
  // CSS custom properties inline in <style>, which easily exceeds 80 KB.
  const palette = uniqueHexes(`${cssBlob}\n${html.slice(0, 200_000)}`, 12);

  const themeNorm = theme ? normalizeHex(theme) : null;
  const themePrimary =
    themeNorm && !isLowSignalHex(themeNorm) ? themeNorm : null;
  const primary = themePrimary || palette[0] || null;
  const rest = primary ? palette.filter((h) => h !== primary) : palette;
  const secondary = rest[0] ?? null;
  const accent = rest[1] ?? null;

  // Full palette (primary first, then the rest in frequency order)
  const fullPalette = [
    ...(primary ? [primary] : []),
    ...palette.filter((h) => h !== primary),
  ].slice(0, 12);

  const jsonLdProducts = extractJsonLdProducts(html);

  const lines: string[] = [
    "Mechanically extracted from the page HTML (use for colors when credible; otherwise infer):",
  ];
  if (themeNorm) lines.push(`- meta theme-color: ${themeNorm}`);
  else lines.push("- meta theme-color: (not set)");
  if (ogImage) lines.push(`- og:image: ${ogImage}`);
  else lines.push("- og:image: (not set)");
  if (twitterImage) lines.push(`- twitter:image: ${twitterImage}`);
  if (palette.length) {
    lines.push(
      `- CSS / inline color candidates (most frequent first): ${palette.join(", ")}`
    );
  } else {
    lines.push("- CSS / inline color candidates: (none found)");
  }

  if (jsonLdProducts.length) {
    lines.push("");
    lines.push(
      "Detected JSON-LD products (authoritative — match these to the products you extract):"
    );
    for (const p of jsonLdProducts.slice(0, 16)) {
      const parts = [`name="${p.name}"`];
      if (p.url) parts.push(`url=${p.url}`);
      if (p.image) parts.push(`image=${p.image}`);
      lines.push(`- ${parts.join(" ")}`);
    }
  }

  return {
    hintBlock: lines.join("\n"),
    colorFallbacks: {
      primary,
      secondary,
      accent,
      palette: fullPalette,
    },
    jsonLdProducts,
  };
}

/**
 * Pick the final primary/secondary/accent for the imported brand.
 *
 * The detector ranks colors by frequency in the site's CSS — and frequency is
 * a much stronger signal of "real brand color" than whatever the LLM picks
 * (which tends to over-prioritize visual diversity / saturation over actual
 * presence on the page). So we trust detected[0..2] when available, and only
 * fall back to the LLM's choices when the detector found nothing.
 *
 * If the detector returns one or two colors but not three, we fill the empty
 * slots with the LLM's picks (deduped against what the detector already gave
 * us).
 */
export function mergeBrandImportColors(
  output: BrandImport,
  fallbacks: WebsiteVisualExtract["colorFallbacks"]
): BrandImport {
  const detected = fallbacks.palette;

  const llmCandidates = [
    output.primary_color,
    output.secondary_color,
    output.accent_color,
  ]
    .map((c) => c?.toLowerCase().trim() ?? null)
    .filter((c): c is string => !!c && /^#[0-9a-f]{6}$/i.test(c));

  const picked: string[] = [];
  for (const hex of detected) {
    if (picked.length >= 3) break;
    if (!picked.includes(hex)) picked.push(hex);
  }
  for (const hex of llmCandidates) {
    if (picked.length >= 3) break;
    if (!picked.includes(hex)) picked.push(hex);
  }

  return {
    ...output,
    primary_color: picked[0] ?? null,
    secondary_color: picked[1] ?? null,
    accent_color: picked[2] ?? null,
  };
}
