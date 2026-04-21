import { z } from "zod";

const uuid = z.string().uuid();
const shortText = z.string().min(1).max(500);
const longText = z.string().min(1).max(10_000);
const optionalUuid = uuid
  .nullish()
  .or(z.literal("").transform(() => undefined));

const attachmentUrlsField = z.array(z.string().url()).max(4).optional();

/**
 * Composer "mode" — which deliverables the user wants for this turn:
 *   - `full`  (default): structured creative copy + auto-chained image
 *   - `copy`            : structured creative copy only (no image, saves credits)
 *   - `image`           : skip text, generate the image directly (handled
 *                         by the client → /api/image/generate route)
 *
 * For `creativeGenerateSchema` we only ever see `full` or `copy` — `image`
 * mode bypasses this route entirely. We accept all three to keep the type
 * shared, and ignore `image` server-side.
 */
export const composerModeSchema = z
  .enum(["full", "copy", "image"])
  .default("full");

export const creativeGenerateSchema = z.object({
  brandId: uuid,
  threadId: uuid,
  productId: uuid,
  icpId: optionalUuid,
  /** Clients often send explicit `null` for unset context; treat like omitted. */
  templateId: z.string().max(100).nullable().optional(),
  angle: z.string().max(200).nullable().optional(),
  awareness: z.string().max(100).nullable().optional(),
  /** Public Supabase Storage URLs from /api/studio/chat-attachment */
  attachmentUrls: attachmentUrlsField,
  mode: composerModeSchema.optional(),
});

export type ComposerMode = z.infer<typeof composerModeSchema>;

export const creativeReviseSchema = z
  .object({
    brandId: uuid,
    threadId: uuid,
    productId: uuid,
    icpId: optionalUuid,
    userMessage: z.string().max(10_000).optional(),
    attachmentUrls: attachmentUrlsField,
  })
  .refine(
    (d) =>
      (d.userMessage?.trim().length ?? 0) > 0 ||
      (d.attachmentUrls?.length ?? 0) > 0,
    { message: "Send a message or at least one image" }
  );

export const imageGenerateSchema = z.object({
  brandId: uuid,
  threadId: uuid,
  prompt: z.string().min(1).max(2000),
  size: z.enum(["1024x1024", "1536x1024", "1024x1536"]).optional(),
  /**
   * Extra reference image URLs to pass to gpt-image-1 in addition to the
   * product hero / recent chat attachments the server resolves automatically.
   */
  referenceImageUrls: z.array(z.string().url()).max(4).optional(),
});

export const imageEditSchema = z.object({
  brandId: uuid,
  threadId: uuid,
  /** Message that contains the source image (the one the user clicked on). */
  parentMessageId: uuid,
  /** Free-text instruction for what to change in the image. */
  prompt: z.string().min(1).max(2000),
  size: z.enum(["1024x1024", "1536x1024", "1024x1536"]).optional(),
});

export const icpGenerateSchema = z.object({
  brandId: uuid,
  productId: uuid,
});

export const competitorAnalyzeSchema = z.object({
  brandId: uuid,
  competitorId: uuid,
  productId: optionalUuid,
  /** When true (default), only ads not yet analyzed for this scope are
   *  sent to the model and the result is merged with the prior insight.
   *  When false, every in-scope ad is re-analyzed from scratch. */
  onlyNewAds: z.boolean().optional(),
});

export const brandImportSchema = z.object({
  websiteUrl: z.string().min(4).max(2048),
});

export const brandReimportSchema = z.object({
  brandId: uuid,
  websiteUrl: z.string().min(4).max(2048),
});

const brandPaletteColorSchema = z.object({
  segment: z.string().min(1).max(64),
  hex: z.string().min(4).max(32),
});

export const updateBrandSchema = z.object({
  brandId: uuid,
  brand: z.object({
    name: shortText,
    description: z.string().max(5000).optional(),
    category: z.string().max(200).optional(),
    positioning: z.string().max(5000).optional(),
    value_proposition: z.string().max(5000).optional(),
    tone_tags: z.array(z.string().max(50)).max(20).optional(),
    personality_tags: z.array(z.string().max(50)).max(20).optional(),
    /** Segmented colors; when set, primary/secondary/accent are derived server-side. */
    color_palette: z.array(brandPaletteColorSchema).max(16).optional(),
    primary_color: z.string().max(20).nullable().optional(),
    secondary_color: z.string().max(20).nullable().optional(),
    accent_color: z.string().max(20).nullable().optional(),
    style_tags: z.array(z.string().max(50)).max(20).optional(),
  }),
});

export const saveProductSchema = z.object({
  brandId: uuid,
  name: shortText,
  shortDescription: z.string().max(2000).optional(),
  description: z.string().max(10_000).nullable().optional(),
  priceText: z.string().max(200).nullable().optional(),
  /** ISO 4217 hint from import (improves parsing when symbol is ambiguous) */
  priceCurrency: z.string().max(3).nullable().optional(),
  productUrl: z.string().max(2048).nullable().optional(),
  /** Source URL from import; stored in Supabase Storage and linked as primary product image */
  imageUrl: z.string().max(2048).nullable().optional(),
  /** Site base (e.g. https://shop.com) for resolving relative image URLs */
  siteOrigin: z.string().max(2048).optional(),
  keyFeatures: z.array(z.string().max(500)).max(16).optional(),
  productCategory: z.string().max(200).nullable().optional(),
});

export const saveCompetitorSchema = z.object({
  brandId: uuid,
  name: shortText,
  websiteUrl: z.string().max(2048).nullable().optional(),
});

export const billingCheckoutSchema = z.object({
  planCode: z.enum(["starter", "pro"]),
});

export const activateBrandSchema = z.object({
  brandId: uuid,
  /** Same-origin path only; returned as `redirect` in JSON after Set-Cookie. */
  redirectPath: z.string().max(2048).optional(),
});

/**
 * Parse request JSON with a Zod schema.
 * Returns parsed data or a NextResponse 400 error.
 */
export async function parseBody<T>(
  request: Request,
  schema: z.ZodType<T>
): Promise<{ data: T; error?: never } | { data?: never; error: Response }> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    const { NextResponse } = await import("next/server");
    return { error: NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }) };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    const { NextResponse } = await import("next/server");
    const message = result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    return { error: NextResponse.json({ error: `Validation error: ${message}` }, { status: 400 }) };
  }

  return { data: result.data };
}
