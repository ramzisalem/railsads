import { z } from "zod";

// ---------------------------------------------------------------------------
// Creative Generation
// ---------------------------------------------------------------------------

export const CreativeOutputSchema = z.object({
  hooks: z.array(z.string()).describe("3 attention-grabbing opening hooks"),
  headlines: z.array(z.string()).describe("3 short, punchy headlines"),
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
      "A prompt to generate a matching ad image based on the creative direction"
    ),
  recommendation: z
    .string()
    .describe("1-2 sentence recommendation on which hook+headline combo works best"),
});

export type CreativeOutput = z.infer<typeof CreativeOutputSchema>;

// ---------------------------------------------------------------------------
// Creative Revision
// ---------------------------------------------------------------------------

export const CreativeRevisionSchema = z.object({
  hooks: z.array(z.string()).describe("Revised hooks (keep unchanged ones)"),
  headlines: z
    .array(z.string())
    .describe("Revised headlines (keep unchanged ones)"),
  primary_texts: z
    .array(z.string())
    .describe("Revised primary texts (keep unchanged ones)"),
  creative_direction: z
    .string()
    .describe("Updated creative direction if relevant"),
  image_prompt: z
    .string()
    .describe("Updated image prompt if creative direction changed"),
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

export const CompetitorAnalysisSchema = z.object({
  summary: z.string().describe("Overall analysis summary of the competitor's ad strategy"),
  hook_patterns: z.array(z.string()).describe("Common hooks and attention-grabbers used"),
  angle_patterns: z.array(z.string()).describe("Common angles and approaches"),
  emotional_triggers: z.array(z.string()).describe("Emotional triggers leveraged"),
  visual_patterns: z.array(z.string()).describe("Visual patterns and styles observed"),
  offer_patterns: z.array(z.string()).describe("Common offers and deal structures"),
  cta_patterns: z.array(z.string()).describe("Call-to-action patterns used"),
  confidence_score: z.number().min(0).max(100).describe("Confidence in analysis quality, 0-100"),
});

export type CompetitorAnalysis = z.infer<typeof CompetitorAnalysisSchema>;

// ---------------------------------------------------------------------------
// Thread Title
// ---------------------------------------------------------------------------

export const ThreadTitleSchema = z.object({
  title: z.string().describe("A short, descriptive thread title (max 60 chars)"),
});

export type ThreadTitle = z.infer<typeof ThreadTitleSchema>;

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
