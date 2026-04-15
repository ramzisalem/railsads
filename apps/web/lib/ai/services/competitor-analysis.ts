import type { SupabaseClient } from "@supabase/supabase-js";
import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAIClient, getModel } from "../provider";
import {
  CompetitorAnalysisSchema,
  type CompetitorAnalysis,
} from "../schemas";
import {
  buildCompetitorAnalysisPrompt,
  PROMPT_VERSIONS,
} from "../prompts";
import { fetchBrandContext, fetchCompetitorAds } from "../context";
import { createAiRun, completeAiRun, failAiRun } from "../tracking";

export interface AnalyzeCompetitorParams {
  brandId: string;
  competitorId: string;
  userId: string;
}

export interface AnalyzeCompetitorResult {
  output: CompetitorAnalysis;
  runId: string | null;
}

export async function analyzeCompetitor(
  supabase: SupabaseClient,
  params: AnalyzeCompetitorParams
): Promise<AnalyzeCompetitorResult> {
  const model = getModel("efficient");

  const runId = await createAiRun(supabase, {
    brandId: params.brandId,
    serviceType: "competitor_analysis",
    model,
    promptVersion: PROMPT_VERSIONS.competitor_analysis,
    userId: params.userId,
  });

  try {
    const [brand, { competitorName, ads }] = await Promise.all([
      fetchBrandContext(supabase, params.brandId),
      fetchCompetitorAds(supabase, params.competitorId),
    ]);

    if (ads.length === 0) {
      throw new Error(
        "No ads found for this competitor. Add some ads before running analysis."
      );
    }

    const { system, user } = buildCompetitorAnalysisPrompt({
      brand,
      competitorName,
      ads,
    });

    const client = getOpenAIClient();
    const response = await client.responses.parse({
      model,
      instructions: system,
      input: user,
      text: {
        format: zodTextFormat(
          CompetitorAnalysisSchema,
          "competitor_analysis"
        ),
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
