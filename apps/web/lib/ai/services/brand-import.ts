import type { SupabaseClient } from "@supabase/supabase-js";
import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAIClient, getModel } from "../provider";
import { BrandImportSchema, type BrandImport } from "../schemas";
import { buildBrandImportPrompt, PROMPT_VERSIONS } from "../prompts";
import { createAiRun, completeAiRun, failAiRun } from "../tracking";
import {
  extractWebsiteVisualData,
  mergeBrandImportColors,
  type JsonLdProductHint,
} from "../website-visual-extract";

async function fetchWebsiteHtml(url: string): Promise<string> {
  const normalizedUrl = url.startsWith("http") ? url : `https://${url}`;

  const response = await fetch(normalizedUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; RailsAds/1.0; +https://railsads.com)",
      Accept: "text/html",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch website (${response.status}): ${normalizedUrl}`
    );
  }

  return response.text();
}

/**
 * Strip to plain text for the LLM, but **preserve** image and link tokens so
 * the model can bind product names to nearby images / PDP URLs.
 *
 * Colors and JSON-LD products are supplied separately via
 * {@link extractWebsiteVisualData} so we don't lose those signals either.
 */
function htmlToImportPlainText(html: string): string {
  const withTokens = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, " [HEADER] ")
    // Preserve <img> as a single inline token so the LLM can associate
    // images with adjacent product names / headings / link text.
    .replace(/<img\b([^>]*)>/gi, (_full, attrs: string) => {
      const src =
        attrs.match(/\b(?:src|data-src|data-original)=["']([^"']+)["']/i)?.[1];
      const alt = attrs.match(/\balt=["']([^"']*)["']/i)?.[1];
      if (!src) return " ";
      const safeAlt = alt ? ` alt="${alt.slice(0, 80).replace(/"/g, "")}"` : "";
      return ` [IMG src=${src}${safeAlt}] `;
    })
    // Preserve product-detail anchors so the LLM can lift product_url.
    .replace(/<a\b([^>]*)>/gi, (_full, attrs: string) => {
      const href = attrs.match(/\bhref=["']([^"']+)["']/i)?.[1];
      if (!href) return " ";
      return ` [LINK href=${href}] `;
    })
    .replace(/<\/a>/gi, " [/LINK] ");

  const cleaned = withTokens
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned.slice(0, 18000);
}

export interface ImportBrandParams {
  websiteUrl: string;
  /**
   * Optional. When omitted (e.g. mid-onboarding before the brand row exists)
   * the AI run is not persisted to `ai_runs` (see `createAiRun`).
   */
  brandId?: string;
  userId: string;
}

export interface ImportBrandResult {
  output: BrandImport;
  runId: string | null;
  /** Raw homepage HTML — exposed for downstream PDP discovery (anchor scan) */
  homepageHtml: string;
  /** Structured JSON-LD products found on the homepage */
  jsonLdProducts: JsonLdProductHint[];
  /**
   * Full de-duplicated color palette mined from the site's CSS (hex, rgb(),
   * rgba(), hsl(), CSS-variable triplets). Ordered most-frequent first.
   * Primary/secondary/accent already live on `output`; this carries the rest.
   */
  detectedPalette: string[];
}

export async function importBrand(
  supabase: SupabaseClient,
  params: ImportBrandParams
): Promise<ImportBrandResult> {
  const model = getModel("efficient");

  const runId = await createAiRun(supabase, {
    brandId: params.brandId,
    serviceType: "brand_import",
    model,
    promptVersion: PROMPT_VERSIONS.brand_import,
    userId: params.userId,
  });

  try {
    const rawHtml = await fetchWebsiteHtml(params.websiteUrl);
    const visual = extractWebsiteVisualData(rawHtml);
    const websiteContent = htmlToImportPlainText(rawHtml);

    const { system, user } = buildBrandImportPrompt(
      websiteContent,
      visual.hintBlock
    );

    const client = getOpenAIClient();
    const response = await client.responses.parse({
      model,
      instructions: system,
      input: user,
      text: {
        format: zodTextFormat(BrandImportSchema, "brand_import"),
      },
    });

    const parsed = response.output_parsed;
    if (!parsed) {
      throw new Error("No structured output returned from OpenAI");
    }

    const output = mergeBrandImportColors(parsed, visual.colorFallbacks);

    if (runId) {
      await completeAiRun(supabase, runId, {
        inputTokens: response.usage?.input_tokens,
        outputTokens: response.usage?.output_tokens,
        totalTokens: response.usage?.total_tokens,
        responsePayload: output,
      });
    }

    return {
      output,
      runId,
      homepageHtml: rawHtml,
      jsonLdProducts: visual.jsonLdProducts,
      detectedPalette: visual.colorFallbacks.palette,
    };
  } catch (error) {
    if (runId) {
      await failAiRun(
        supabase,
        runId,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
    throw error;
  }
}
