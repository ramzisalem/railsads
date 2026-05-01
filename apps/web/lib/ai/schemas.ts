import { z } from "zod";

// ---------------------------------------------------------------------------
// Creative Generation
// ---------------------------------------------------------------------------

export const CreativeOutputSchema = z.object({
  hooks: z
    .array(z.string())
    .describe(
      "3 attention-grabbing opening hooks. The FIRST item is your top recommendation and will be baked into the image as on-image text."
    ),
  headlines: z
    .array(z.string())
    .describe(
      "3 short, punchy headlines (under 10 words each). The FIRST item is your top recommendation and will be baked into the image as on-image text."
    ),
  primary_texts: z
    .array(z.string())
    .describe("2 longer-form ad body copy variations"),
  creative_direction: z
    .string()
    .describe(
      "Brief creative direction describing the visual style, mood, and approach"
    ),
  image_prompt: z
    .string()
    .describe(
      "A prompt for an image model to produce the FINISHED ad. Must describe a single composed scene that bakes the FIRST hook AND FIRST headline as on-image text overlays — quote each string verbatim in double quotes, specify position (upper/lower third, centered/left), typography (weight + brand-aligned color), treatment (shadow/outline), and reserve negative space for legibility. The image will be uploaded as-is to Meta / TikTok / YouTube — copy must already be on the image."
    ),
  recommendation: z
    .string()
    .describe(
      "1-2 sentence recommendation explaining why hook[0] + headline[0] are the strongest pairing for this audience."
    ),
});

export type CreativeOutput = z.infer<typeof CreativeOutputSchema>;

// ---------------------------------------------------------------------------
// Creative Revision
// ---------------------------------------------------------------------------

export const CreativeRevisionSchema = z.object({
  hooks: z
    .array(z.string())
    .describe(
      "Revised hooks (keep unchanged ones). The FIRST item is your top recommendation and will be baked into the revised image as on-image text."
    ),
  headlines: z
    .array(z.string())
    .describe(
      "Revised headlines (keep unchanged ones). The FIRST item is your top recommendation and will be baked into the revised image as on-image text."
    ),
  primary_texts: z
    .array(z.string())
    .describe("Revised primary texts (keep unchanged ones)"),
  creative_direction: z
    .string()
    .describe("Updated creative direction if relevant"),
  image_prompt: z
    .string()
    .describe(
      "Updated image_prompt for a FINISHED ad. Must bake the FIRST revised hook AND FIRST revised headline into the scene as on-image text overlays — quote both strings verbatim, specify position, typography, and treatment, and reserve negative space for legibility. If only the copy changed, keep the underlying scene the same and only swap the on-image text strings + their styling."
    ),
  change_summary: z
    .string()
    .describe("Brief explanation of what was changed and why"),
});

export type CreativeRevision = z.infer<typeof CreativeRevisionSchema>;

// ---------------------------------------------------------------------------
// ICP Generation
// ---------------------------------------------------------------------------

export const IcpItemSchema = z.object({
  title: z.string().describe("Short label like 'Busy Professionals' or 'Health-Conscious Parents'"),
  summary: z.string().describe("1-2 sentence description of this audience segment"),
  pains: z.array(z.string()).describe("3-5 specific pain points this audience experiences"),
  desires: z.array(z.string()).describe("3-5 specific desires or goals"),
  objections: z.array(z.string()).describe("2-4 common objections to buying"),
  triggers: z.array(z.string()).describe("2-4 moments or events that trigger a purchase decision"),
});

export const IcpGenerationSchema = z.object({
  icps: z.array(IcpItemSchema).describe("3 distinct ideal customer profiles"),
});

export type IcpGeneration = z.infer<typeof IcpGenerationSchema>;
export type IcpItem = z.infer<typeof IcpItemSchema>;

// ---------------------------------------------------------------------------
// Competitor Analysis
// ---------------------------------------------------------------------------

export const COMPETITOR_PATTERN_CATEGORIES = [
  "hook",
  "angle",
  "emotional",
  "visual",
  "offer",
  "cta",
] as const;

export const CompetitorEvidenceItemSchema = z.object({
  category: z
    .enum(COMPETITOR_PATTERN_CATEGORIES)
    .describe(
      "Which pattern bucket this citation belongs to. Must match the pattern arrays below."
    ),
  pattern: z
    .string()
    .describe(
      "The exact pattern string this citation supports — copy it verbatim from the matching `*_patterns` array."
    ),
  evidence_ad_ids: z
    .array(z.string())
    .describe(
      "Ad reference ids ('ad-1', 'ad-2', …) that demonstrate this pattern. Use the labels from the prompt — IDs are mapped back to UUIDs server-side."
    ),
});

export const CompetitorAnalysisSchema = z.object({
  summary: z.string().describe("Overall analysis summary of the competitor's ad strategy"),
  hook_patterns: z.array(z.string()).describe("Common hooks and attention-grabbers used"),
  angle_patterns: z.array(z.string()).describe("Common angles and approaches"),
  emotional_triggers: z.array(z.string()).describe("Emotional triggers leveraged"),
  visual_patterns: z.array(z.string()).describe("Visual patterns and styles observed"),
  offer_patterns: z.array(z.string()).describe("Common offers and deal structures"),
  cta_patterns: z.array(z.string()).describe("Call-to-action patterns used"),
  evidence: z
    .array(CompetitorEvidenceItemSchema)
    .describe(
      "Citations grounding each pattern in specific ads. Every pattern in the *_patterns arrays above MUST appear in at least one evidence entry."
    ),
  confidence_score: z.number().min(0).max(100).describe("Confidence in analysis quality, 0-100"),
});

export type CompetitorAnalysis = z.infer<typeof CompetitorAnalysisSchema>;
export type CompetitorEvidenceItem = z.infer<typeof CompetitorEvidenceItemSchema>;

// ---------------------------------------------------------------------------
// Thread Title
// ---------------------------------------------------------------------------

export const ThreadTitleSchema = z.object({
  title: z.string().describe("A short, descriptive thread title (max 60 chars)"),
});

export type ThreadTitle = z.infer<typeof ThreadTitleSchema>;

// ---------------------------------------------------------------------------
// Studio Chat (free-form brainstorming / Q&A replies)
// ---------------------------------------------------------------------------
//
// Used by the "Brainstorm angles" / "Visual concept" starters and any other
// studio turn that wants a text answer instead of a structured creative
// payload. Kept as a single `answer` field so the model's output lands
// verbatim in `messages.content` without being squeezed into the ad-card UI.

export const StudioChatSchema = z.object({
  answer: z
    .string()
    .describe(
      "A clear, helpful plain-text reply to the user's request. Use markdown for short lists and bold where it aids scanning. Keep it focused and skimmable."
    ),
});

export type StudioChat = z.infer<typeof StudioChatSchema>;

// ---------------------------------------------------------------------------
// Brand Import
// ---------------------------------------------------------------------------

export const BrandImportSchema = z.object({
  name: z.string().describe("Brand name"),
  description: z.string().describe("1-2 sentence brand description"),
  category: z.string().describe("Industry or product category"),
  positioning: z.string().describe("Brand positioning statement"),
  value_proposition: z.string().describe("Core value proposition"),
  tone_tags: z.array(z.string()).describe("3-5 tone descriptors like 'modern', 'friendly', 'bold'"),
  personality_tags: z.array(z.string()).describe("3-5 personality traits"),
  primary_color: z.string().nullable().describe("Primary brand color as hex, or null"),
  secondary_color: z.string().nullable().describe("Secondary brand color as hex, or null"),
  accent_color: z.string().nullable().describe("Accent color as hex, or null"),
  style_tags: z.array(z.string()).describe("Visual style descriptors"),
  products: z.array(
    z.object({
      name: z.string(),
      short_description: z.string(),
      description: z
        .string()
        .nullable()
        .optional()
        .describe(
          "Longer PDP-style copy, specs paragraph, or marketing body when clearly tied to this product"
        ),
      price_text: z
        .string()
        .nullable()
        .describe("Price exactly as shown, e.g. $99, From €49/mo, $1,299.00"),
      price_currency: z
        .string()
        .nullable()
        .optional()
        .describe("ISO 4217 when known from the page (USD, EUR, GBP, …); null if unclear"),
      product_url: z
        .string()
        .nullable()
        .describe(
          "Canonical product detail page URL path or full URL from the site; prefer /products/… over checkout"
        ),
      image_url: z
        .string()
        .nullable()
        .optional()
        .describe(
          "Direct or site-relative URL to a product hero image, or null if none found"
        ),
      key_features: z
        .array(z.string())
        .max(16)
        .nullable()
        .optional()
        .describe("Bullet features, specs, or differentiators visible for this SKU"),
      product_category: z
        .string()
        .nullable()
        .optional()
        .describe("Product type or collection label when shown (e.g. Serum, SaaS plan)"),
    })
  ).describe("Products found on the website"),
});

export type BrandImport = z.infer<typeof BrandImportSchema>;
