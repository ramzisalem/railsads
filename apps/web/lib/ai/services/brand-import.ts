import type { SupabaseClient } from "@supabase/supabase-js";
import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAIClient, getModel } from "../provider";
import { BrandImportSchema, type BrandImport } from "../schemas";
import { buildBrandImportPrompt, PROMPT_VERSIONS } from "../prompts";
import { createAiRun, completeAiRun, failAiRun } from "../tracking";
import {
  extractWebsiteVisualData,
  mergeBrandImportColors,
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
 * Strip to plain text for the LLM (colors are supplied separately via
 * {@link extractWebsiteVisualData} so we don't lose CSS hex values).
 */
function htmlToImportPlainText(html: string): string {
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, " [HEADER] ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned.slice(0, 15000);
}

export interface ImportBrandParams {
  websiteUrl: string;
  brandId: string;
  userId: string;
}

export interface ImportBrandResult {
  output: BrandImport;
  runId: string | null;
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

    return { output, runId };
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
