/**
 * Segmented brand colors for UI and AI prompts.
 * Legacy `primary_color` / `secondary_color` / `accent_color` stay in sync when persisting.
 */

export interface BrandPaletteColor {
  segment: string;
  hex: string;
}

export const PALETTE_SEGMENT_PRESETS = [
  { value: "primary", label: "Primary" },
  { value: "secondary", label: "Secondary" },
  { value: "accent", label: "Accent" },
  { value: "background", label: "Background" },
  { value: "text", label: "Text" },
  { value: "highlight", label: "Highlight" },
  { value: "neutral", label: "Neutral" },
] as const;

function normSegment(s: string): string {
  return s.trim().toLowerCase();
}

function normHex(hex: string): string {
  const t = hex.trim();
  if (!t) return "";
  const withHash = t.startsWith("#") ? t : `#${t}`;
  return withHash.slice(0, 8);
}

/** Build palette rows from legacy import columns (skips null / empty hex). */
export function paletteFromLegacyColors(visual: {
  primary_color?: string | null;
  secondary_color?: string | null;
  accent_color?: string | null;
}): BrandPaletteColor[] {
  const rows: BrandPaletteColor[] = [];
  if (visual.primary_color?.trim()) {
    rows.push({ segment: "primary", hex: normHex(visual.primary_color) });
  }
  if (visual.secondary_color?.trim()) {
    rows.push({ segment: "secondary", hex: normHex(visual.secondary_color) });
  }
  if (visual.accent_color?.trim()) {
    rows.push({ segment: "accent", hex: normHex(visual.accent_color) });
  }
  return rows;
}

/**
 * Parse DB json (unknown) into a clean palette list.
 */
export function parseColorPalette(raw: unknown): BrandPaletteColor[] {
  if (!Array.isArray(raw)) return [];
  const out: BrandPaletteColor[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const segment =
      typeof o.segment === "string" ? o.segment.trim() : "";
    const hex = typeof o.hex === "string" ? normHex(o.hex) : "";
    if (!segment || !hex) continue;
    out.push({ segment, hex });
  }
  return out;
}

/** Effective palette: stored rows, or legacy columns if palette is empty. */
export function effectiveColorPalette(visual: {
  color_palette?: unknown;
  primary_color?: string | null;
  secondary_color?: string | null;
  accent_color?: string | null;
}): BrandPaletteColor[] {
  const parsed = parseColorPalette(visual.color_palette);
  if (parsed.length > 0) return parsed;
  return paletteFromLegacyColors(visual);
}

export function syncLegacyColorsFromPalette(
  palette: BrandPaletteColor[]
): {
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
} {
  const find = (key: "primary" | "secondary" | "accent") => {
    const row = palette.find(
      (c) => normSegment(c.segment) === key && c.hex.trim()
    );
    return row?.hex.trim() ? normHex(row.hex) : null;
  };
  return {
    primary_color: find("primary"),
    secondary_color: find("secondary"),
    accent_color: find("accent"),
  };
}

export function paletteForDb(
  palette: BrandPaletteColor[]
): BrandPaletteColor[] {
  return palette
    .map((c) => ({
      segment: c.segment.trim(),
      hex: normHex(c.hex),
    }))
    .filter((c) => c.segment && c.hex);
}

/**
 * Extend an LLM-derived palette (primary/secondary/accent) with every other
 * brand color we mechanically detected on the site's CSS, using preset
 * segment names ("background", "highlight", …) then generic fallbacks.
 *
 * Skips colors whose hex already appears in the palette (case-insensitive) so
 * the primary/secondary/accent never get duplicated.
 */
export function extendPaletteWithExtraHexes(
  palette: BrandPaletteColor[],
  extraHexes: readonly string[]
): BrandPaletteColor[] {
  const seenHex = new Set(palette.map((c) => c.hex.toLowerCase()));
  const usedSegments = new Set(palette.map((c) => normSegment(c.segment)));

  const fallbackPresets = PALETTE_SEGMENT_PRESETS.map((p) => p.value).filter(
    (v) => !usedSegments.has(v)
  );

  const out = [...palette];
  let genericCounter = 1;
  for (const raw of extraHexes) {
    const hex = normHex(raw);
    if (!hex) continue;
    const lc = hex.toLowerCase();
    if (seenHex.has(lc)) continue;
    seenHex.add(lc);
    const segment =
      fallbackPresets.shift() ?? `color ${palette.length + genericCounter++}`;
    out.push({ segment, hex });
  }
  return out;
}
