/** Visual preset id for ratio icons (see `AspectRatioGlyph`). */
export type ImageGenRatioGlyphId = "1:1" | "16:9" | "9:16";

/** OpenAI image API sizes supported in this app (gpt-image-1). */
export type ImageGenSize = "1024x1024" | "1536x1024" | "1024x1536";

export const IMAGE_GEN_RATIO_OPTIONS: ReadonlyArray<{
  size: ImageGenSize;
  label: string;
  ratioGlyph: ImageGenRatioGlyphId;
  hint: string;
}> = [
  {
    size: "1024x1024",
    label: "1:1",
    ratioGlyph: "1:1",
    hint: "Square output 1024×1024 — balanced framing for feeds and product shots.",
  },
  {
    size: "1536x1024",
    label: "16:9",
    ratioGlyph: "16:9",
    hint: "Landscape 1536×1024 (3:2) — wide hero and link-ad style layouts.",
  },
  {
    size: "1024x1536",
    label: "9:16",
    ratioGlyph: "9:16",
    hint: "Portrait 1024×1536 (2:3) — vertical / Stories-style placements.",
  },
];

export const DEFAULT_IMAGE_GEN_SIZE: ImageGenSize = "1536x1024";
