import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import type { ResponseInput } from "openai/resources/responses/responses";
import { getModel, getOpenAIClient } from "../provider";

/**
 * Vision-driven extraction of structured metadata from a competitor ad
 * (screenshot, or hero image scraped from a paste-in URL).
 *
 * The extractor never invents — every field is nullable so the model can
 * report "not visible" rather than hallucinate. We pass the brand context
 * so the model can describe how the ad differs from us, and the source URL
 * (when known) so it can guess platform from the host.
 *
 * Used by:
 *   - apps/web/app/api/competitors/ads/extract/route.ts (image upload + URL paste)
 *   - apps/web/lib/competitors/actions.ts (`createCompetitorAdFromImage` / `…FromUrl`)
 */

const PLATFORM_HINTS = [
  "Facebook",
  "Instagram",
  "TikTok",
  "YouTube",
  "Pinterest",
  "Snapchat",
  "Twitter / X",
  "LinkedIn",
  "Google Display",
  "Reddit",
  "Landing page",
  "Email",
  "Other",
] as const;

export const CompetitorAdExtractSchema = z.object({
  title: z
    .string()
    .nullable()
    .describe(
      "Short label for the ad (3-8 words). Use the strongest visible headline or a concise summary like \"Summer 50% off — bottle hero\". Null only if absolutely nothing identifiable."
    ),
  ad_text: z
    .string()
    .nullable()
    .describe(
      "All visible ad copy: headline + body + on-image text + offer language. Preserve line breaks. Null if no copy is visible."
    ),
  platform: z
    .enum(PLATFORM_HINTS)
    .nullable()
    .describe(
      "Best-guess delivery platform based on UI chrome (Meta ad library frame, TikTok overlay, etc.) or the source URL host. Null if truly unclear."
    ),
  cta: z
    .string()
    .nullable()
    .describe("Call-to-action button or phrase (e.g. \"Shop now\", \"Learn more\")."),
  offer: z
    .string()
    .nullable()
    .describe("Headline offer or discount if visible (e.g. \"50% off\", \"Free trial\")."),
  visual_summary: z
    .string()
    .nullable()
    .describe(
      "1-2 sentence neutral description of the visual: subject, composition, lighting, mood, on-image text treatment. Used as a multimodal-friendly fallback when downstream prompts can't load the image."
    ),
  notes: z
    .string()
    .nullable()
    .describe("Anything notable for competitive analysis: hook style, angle, social proof, urgency."),
});

export type CompetitorAdExtract = z.infer<typeof CompetitorAdExtractSchema>;

export interface ExtractCompetitorAdParams {
  /**
   * Public URLs of competitor ad images (uploaded screenshots or scraped
   * og:image). Vision is run over these. At least one of `imageUrls` or
   * `pageText` must be non-empty.
   */
  imageUrls: string[];
  /** Original source URL the user pasted, if any. Used as a platform hint. */
  sourceUrl?: string | null;
  /** Plain-text snippet extracted from a pasted landing/ad page (~2KB cap). */
  pageText?: string | null;
  /** Brand name for context — helps the model phrase competitive notes. */
  brandName?: string | null;
}

const MAX_IMAGES = 4;

export async function extractCompetitorAd(
  params: ExtractCompetitorAdParams
): Promise<CompetitorAdExtract | null> {
  const images = params.imageUrls.slice(0, MAX_IMAGES);
  if (images.length === 0 && !params.pageText?.trim()) {
    return null;
  }

  const client = getOpenAIClient();
  const model = getModel("efficient");

  const lines: string[] = [
    "Extract structured metadata from this competitor advertisement.",
    "",
    "Rules:",
    "- Be faithful to what is visible. Do NOT invent copy or claims.",
    "- Quote on-image text verbatim into ad_text (preserve line breaks).",
    "- Pick `platform` from the enum based on UI chrome (Meta Ad Library frame, TikTok overlay, etc.) or the source URL host.",
    "- visual_summary should be a neutral, prompt-friendly description of subject + composition + treatment, NOT marketing language.",
    "- If a field is truly unknown, return null — never guess a discount that isn't visible.",
  ];

  if (params.brandName) {
    lines.push("", `Our brand context: "${params.brandName}". Phrase notes from a competitive-analyst perspective.`);
  }
  if (params.sourceUrl) {
    lines.push("", `Source URL: ${params.sourceUrl}`);
  }
  if (params.pageText?.trim()) {
    lines.push(
      "",
      "Landing/ad page text (truncated):",
      params.pageText.trim().slice(0, 2000)
    );
  }
  if (images.length === 0) {
    lines.push(
      "",
      "No image was provided. Extract everything possible from the page text alone and set visual_summary to null."
    );
  }

  const text = lines.join("\n");

  const messageContent: Array<
    | { type: "input_text"; text: string }
    | { type: "input_image"; image_url: string; detail: "auto" }
  > = [{ type: "input_text", text }];

  for (const url of images) {
    messageContent.push({ type: "input_image", image_url: url, detail: "auto" });
  }

  const input: ResponseInput =
    images.length > 0
      ? [{ role: "user", type: "message", content: messageContent }]
      : [{ role: "user", type: "message", content: [{ type: "input_text", text }] }];

  try {
    const response = await client.responses.parse({
      model,
      instructions:
        "You are a competitive-intelligence analyst extracting structured metadata from competitor ads. Be precise and never invent. Always return JSON matching the provided schema.",
      input,
      text: {
        format: zodTextFormat(CompetitorAdExtractSchema, "competitor_ad_extract"),
      },
    });

    return response.output_parsed ?? null;
  } catch (err) {
    console.error("extractCompetitorAd failed:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// URL paste — fetch a page and pull out the hero image + clean text snippet
// ---------------------------------------------------------------------------

export interface FetchedPagePreview {
  /** Absolute https URL to the best hero image we found, or null. */
  imageUrl: string | null;
  /** Plain-text snippet from <title>, og:description, body. ~2KB cap. */
  text: string;
  /** Final URL after any redirects (useful as canonical source_url). */
  finalUrl: string;
  /** og:url, JSON-LD url, or first PDP-looking anchor — for landing_page_url. */
  landingPageUrl: string | null;
}

const PAGE_FETCH_TIMEOUT_MS = 12_000;

export async function fetchCompetitorPagePreview(
  rawUrl: string
): Promise<FetchedPagePreview | null> {
  const url = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; RailsAds/1.0; +https://railsads.com)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(PAGE_FETCH_TIMEOUT_MS),
      redirect: "follow",
    });
  } catch (err) {
    console.warn("fetchCompetitorPagePreview: fetch failed", url, err);
    return null;
  }

  if (!response.ok) {
    console.warn(
      `fetchCompetitorPagePreview: ${response.status} for ${url}`
    );
    return null;
  }

  const html = await response.text();
  const finalUrl = response.url || url;

  return parseCompetitorPageHtml(html, finalUrl);
}

function parseCompetitorPageHtml(
  html: string,
  finalUrl: string
): FetchedPagePreview {
  const meta = (name: string): string | null => {
    const re = new RegExp(
      `<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']+)["']`,
      "i"
    );
    return html.match(re)?.[1] ?? null;
  };

  const ogImage =
    meta("og:image") ?? meta("twitter:image") ?? meta("twitter:image:src");
  const ogUrl = meta("og:url");
  const description =
    meta("og:description") ?? meta("twitter:description") ?? meta("description");

  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch?.[1]?.trim() ?? null;

  const bodyText = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 2000);

  const textParts: string[] = [];
  if (title) textParts.push(`Title: ${title}`);
  if (description) textParts.push(`Description: ${description}`);
  if (bodyText) textParts.push(`Body: ${bodyText}`);

  return {
    imageUrl: absolutize(ogImage, finalUrl),
    text: textParts.join("\n\n"),
    finalUrl,
    landingPageUrl: absolutize(ogUrl, finalUrl) ?? finalUrl,
  };
}

function absolutize(maybeUrl: string | null, baseUrl: string): string | null {
  if (!maybeUrl) return null;
  try {
    return new URL(maybeUrl, baseUrl).toString();
  } catch {
    return null;
  }
}
