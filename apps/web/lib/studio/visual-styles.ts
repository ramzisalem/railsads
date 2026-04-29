/**
 * Visual style presets for the Creative Studio "Output → Visual style" picker.
 *
 * A visual style is a high-level look-and-feel direction that shapes BOTH the
 * structured `creative_direction` (so the copywriter knows the vibe) AND the
 * `image_prompt` (so the image model renders in the chosen aesthetic). It sits
 * alongside the brand's own `style_tags` — those are persistent brand DNA, the
 * visual style is a per-thread creative choice the user can swap freely.
 *
 * The DB stores the `value` token (text column, nullable). Unknown tokens are
 * passed through verbatim to the model so we can experiment with new styles
 * without a migration.
 */

export type VisualStyleId =
  | "photorealistic"
  | "cinematic"
  | "minimalist"
  | "bold_vibrant"
  | "editorial"
  | "illustrated"
  | "ugc_authentic"
  | "retro";

export interface VisualStylePreset {
  /** DB token. Stable across deploys. */
  value: VisualStyleId;
  /** Display label for the picker chip / summary row. */
  label: string;
  /** One-line hint shown under the label / on hover. */
  description: string;
  /**
   * Prompt fragment injected into the AI context. Phrased as a directive the
   * copywriter + image model can follow ("Render … with …"). Brand colors and
   * product realism still take priority — the style sets the *aesthetic*, not
   * the subject.
   */
  prompt: string;
}

export const VISUAL_STYLE_PRESETS: ReadonlyArray<VisualStylePreset> = [
  {
    value: "photorealistic",
    label: "Photorealistic",
    description: "Crisp product photography with realistic lighting and detail.",
    prompt:
      "Photorealistic studio / lifestyle photography aesthetic. Sharp focus on the product, natural-but-controlled lighting, realistic materials and textures, believable depth of field. Avoid CGI, illustration, or stylized rendering — it should look like a real camera shot.",
  },
  {
    value: "cinematic",
    label: "Cinematic",
    description: "Moody, film-like, strong directional lighting and depth.",
    prompt:
      "Cinematic, film-still aesthetic. Strong directional lighting (rim light or single key), shallow depth of field, slight color grade (teal/orange or muted tones), atmospheric haze or volumetrics where it suits the scene. Composition feels like a frame from a high-end commercial spot.",
  },
  {
    value: "minimalist",
    label: "Minimalist",
    description: "Clean, lots of negative space, simple composition.",
    prompt:
      "Minimalist editorial aesthetic. Flat or single-tone background, generous negative space, the product centered or rule-of-thirds with one or two supporting props max. No clutter, restrained palette, soft even lighting. Typography sits in the negative space without crowding.",
  },
  {
    value: "bold_vibrant",
    label: "Bold & Vibrant",
    description: "Saturated colors, high contrast, scroll-stopping energy.",
    prompt:
      "Bold, high-energy aesthetic. Saturated brand-aligned colors, strong contrast, geometric shapes or color blocks framing the product. Punchy lighting that makes the product pop off the canvas. Designed to stop the scroll on a busy feed.",
  },
  {
    value: "editorial",
    label: "Editorial",
    description: "Magazine-quality lifestyle with considered styling.",
    prompt:
      "Editorial lifestyle aesthetic — like a high-end magazine spread. Considered prop styling, natural human moments around the product, slightly desaturated film-emulation grade. The product is integrated into an aspirational scene rather than isolated on a backdrop.",
  },
  {
    value: "illustrated",
    label: "Illustrated",
    description: "Hand-drawn or vector illustration aesthetic.",
    prompt:
      "Illustrated aesthetic — flat vector or textured hand-drawn style depending on what suits the brand. Bold shapes, brand-aligned color palette, the product rendered as illustrated art (not photographic). Keep the product silhouette and label legible so customers still recognize it.",
  },
  {
    value: "ugc_authentic",
    label: "UGC / Authentic",
    description: "Phone-shot, casual, looks like real customer content.",
    prompt:
      "User-generated-content aesthetic. Looks like it was shot on a phone in a real home / car / cafe — slightly imperfect framing, natural ambient light, casual hand-held feel. Product held or used in-context by a real person. Avoid studio polish; favor authenticity and relatability.",
  },
  {
    value: "retro",
    label: "Retro / Vintage",
    description: "Nostalgic palette, vintage grading, throwback styling.",
    prompt:
      "Retro / vintage aesthetic. Nostalgic color palette (warm earth tones, faded primaries, or 80s/90s neon depending on the brand vibe), film grain, period-appropriate props and typography styling cues. The product still looks current — only the world around it is throwback.",
  },
];

/** Map for fast lookup; safe to call with unknown values (returns undefined). */
const BY_VALUE = new Map<string, VisualStylePreset>(
  VISUAL_STYLE_PRESETS.map((s) => [s.value, s])
);

export function getVisualStylePreset(
  value: string | null | undefined
): VisualStylePreset | undefined {
  if (!value) return undefined;
  return BY_VALUE.get(value);
}

/**
 * Resolve a stored value into the prompt fragment the AI sees. Known presets
 * use their curated copy; unknown tokens are returned verbatim so we can A/B
 * styles without a deploy. Returns undefined when nothing is set so callers
 * can skip the section entirely.
 */
export function visualStylePromptFragment(
  value: string | null | undefined
): string | undefined {
  if (!value) return undefined;
  const preset = BY_VALUE.get(value);
  return preset?.prompt ?? value;
}

/**
 * Resolve a stored value into a short human label (for prompt context blocks
 * and analytics). Falls back to the raw token when unknown.
 */
export function visualStyleLabel(
  value: string | null | undefined
): string | undefined {
  if (!value) return undefined;
  return BY_VALUE.get(value)?.label ?? value;
}
