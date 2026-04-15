import type { BrandImport } from "./schemas";

const HEX_RE = /#(?:[0-9a-fA-F]{3}){1,2}\b/g;

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
  if (max - min < 10) return true;
  return false;
}

function uniqueHexes(text: string, cap: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const m of text.matchAll(HEX_RE)) {
    const n = normalizeHex(m[0]);
    if (!n || isLowSignalHex(n) || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
    if (out.length >= cap) break;
  }
  return out;
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

export interface WebsiteVisualExtract {
  /** Extra context appended to the brand-import prompt */
  hintBlock: string;
  /** When the model returns null colors, prefer these (meta + CSS palette) */
  colorFallbacks: {
    primary: string | null;
    secondary: string | null;
    accent: string | null;
  };
}

/**
 * Derive color hints and a short machine-readable block from raw HTML
 * (before scripts/styles are stripped for the text-only crawl).
 */
export function extractWebsiteVisualData(html: string): WebsiteVisualExtract {
  const theme =
    metaContent(html, "name", "theme-color") ||
    metaContent(html, "name", "msapplication-TileColor");
  const ogImage = metaContent(html, "property", "og:image");

  const cssBlob = extractStyleAndInlineCss(html);
  const palette = uniqueHexes(`${cssBlob}\n${html.slice(0, 80_000)}`, 12);

  const themeNorm = theme ? normalizeHex(theme) : null;
  const themePrimary =
    themeNorm && !isLowSignalHex(themeNorm) ? themeNorm : null;
  const primary = themePrimary || palette[0] || null;
  const rest = primary ? palette.filter((h) => h !== primary) : palette;
  const secondary = rest[0] ?? null;
  const accent = rest[1] ?? null;

  const lines: string[] = [
    "Mechanically extracted from the page HTML (use for colors when credible; otherwise infer):",
  ];
  if (themeNorm) lines.push(`- meta theme-color: ${themeNorm}`);
  else lines.push("- meta theme-color: (not set)");
  if (ogImage) lines.push(`- og:image: ${ogImage}`);
  else lines.push("- og:image: (not set)");
  if (palette.length) {
    lines.push(`- CSS / inline hex candidates: ${palette.join(", ")}`);
  } else {
    lines.push("- CSS / inline hex candidates: (none found)");
  }

  return {
    hintBlock: lines.join("\n"),
    colorFallbacks: {
      primary,
      secondary,
      accent,
    },
  };
}

export function mergeBrandImportColors(
  output: BrandImport,
  fallbacks: WebsiteVisualExtract["colorFallbacks"]
): BrandImport {
  return {
    ...output,
    primary_color: output.primary_color ?? fallbacks.primary ?? null,
    secondary_color: output.secondary_color ?? fallbacks.secondary ?? null,
    accent_color: output.accent_color ?? fallbacks.accent ?? null,
  };
}
