import type { SupabaseClient } from "@supabase/supabase-js";
import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAIClient, getModel } from "../provider";
import { CreativeOutputSchema, type CreativeOutput } from "../schemas";
import {
  buildCreativeGenerationPrompt,
  PROMPT_VERSIONS,
} from "../prompts";
import {
  fetchBrandContext,
  fetchProductContext,
  fetchIcpContext,
  fetchTemplateContext,
  fetchCompetitorInsights,
} from "../context";
import { createAiRun, completeAiRun, failAiRun } from "../tracking";

export interface GenerateCreativeParams {
  brandId: string;
  threadId: string;
  productId: string;
  icpId?: string | null;
  templateId?: string | null;
  angle?: string | null;
  awareness?: string | null;
  userId: string;
}

export interface GenerateCreativeResult {
  output: CreativeOutput;
  runId: string | null;
}

export async function generateCreative(
  supabase: SupabaseClient,
  params: GenerateCreativeParams
): Promise<GenerateCreativeResult> {
  const model = getModel("premium");

  const runId = await createAiRun(supabase, {
    brandId: params.brandId,
    threadId: params.threadId,
    serviceType: "creative_generation",
    model,
    promptVersion: PROMPT_VERSIONS.creative_generation,
    userId: params.userId,
  });

  try {
    const [brand, product, icp, template, competitorInsights] =
      await Promise.all([
        fetchBrandContext(supabase, params.brandId),
        fetchProductContext(supabase, params.productId),
        params.icpId ? fetchIcpContext(supabase, params.icpId) : undefined,
        params.templateId
          ? fetchTemplateContext(supabase, params.templateId)
          : undefined,
        fetchCompetitorInsights(supabase, params.brandId),
      ]);

    const { system, user } = buildCreativeGenerationPrompt({
      brand,
      product,
      icp,
      template,
      angle: params.angle ?? undefined,
      awareness: params.awareness ?? undefined,
      competitorInsights:
        competitorInsights.length > 0 ? competitorInsights : undefined,
    });

    const client = getOpenAIClient();
    const response = await client.responses.parse({
      model,
      instructions: system,
      input: user,
      text: {
        format: zodTextFormat(CreativeOutputSchema, "creative_output"),
      },
    });

    const output = response.output_parsed;
    if (!output) {
      throw new Error("No structured output returned from OpenAI");
    }

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
