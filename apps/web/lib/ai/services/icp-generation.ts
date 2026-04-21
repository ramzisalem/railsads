import type { SupabaseClient } from "@supabase/supabase-js";
import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAIClient, getModel } from "../provider";
import { IcpGenerationSchema, type IcpGeneration } from "../schemas";
import {
  buildIcpGenerationPrompt,
  PROMPT_VERSIONS,
  type BrandContext,
  type ProductContext,
} from "../prompts";
import {
  fetchBrandContext,
  fetchProductContext,
  fetchExistingIcps,
} from "../context";
import { createAiRun, completeAiRun, failAiRun } from "../tracking";

export interface GenerateIcpsParams {
  brandId: string;
  productId: string;
  userId: string;
}

export interface GenerateIcpsResult {
  output: IcpGeneration;
  runId: string | null;
}

export async function generateIcps(
  supabase: SupabaseClient,
  params: GenerateIcpsParams
): Promise<GenerateIcpsResult> {
  const model = getModel("efficient");

  const runId = await createAiRun(supabase, {
    brandId: params.brandId,
    serviceType: "icp_generation",
    model,
    promptVersion: PROMPT_VERSIONS.icp_generation,
    userId: params.userId,
  });

  try {
    const [brand, product, existingIcps] = await Promise.all([
      fetchBrandContext(supabase, params.brandId),
      fetchProductContext(supabase, params.productId),
      fetchExistingIcps(supabase, params.productId),
    ]);

    const { system, user } = buildIcpGenerationPrompt({
      brand,
      product,
      existingIcps: existingIcps.length > 0 ? existingIcps : undefined,
    });

    const client = getOpenAIClient();
    const response = await client.responses.parse({
      model,
      instructions: system,
      input: user,
      text: {
        format: zodTextFormat(IcpGenerationSchema, "icp_generation"),
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

// ---------------------------------------------------------------------------
// Inline variant — used during onboarding before the brand/product rows exist
// ---------------------------------------------------------------------------

export interface GenerateIcpsInlineParams {
  brand: BrandContext;
  product: ProductContext;
  /** Optional list of already-generated ICPs to avoid duplicates across products. */
  existingIcps?: { title: string; summary?: string }[];
}

/**
 * Generates ICPs from in-memory brand + product objects without touching the
 * database. Used by onboarding so we can defer all DB writes (including ICPs
 * and the brand row) to the final "Create" step.
 */
export async function generateIcpsInline(
  params: GenerateIcpsInlineParams
): Promise<IcpGeneration> {
  const model = getModel("efficient");

  const { system, user } = buildIcpGenerationPrompt({
    brand: params.brand,
    product: params.product,
    existingIcps:
      params.existingIcps && params.existingIcps.length > 0
        ? params.existingIcps.map((i) => ({
            title: i.title,
            summary: i.summary,
            pains: [],
            desires: [],
            objections: [],
            triggers: [],
          }))
        : undefined,
  });

  const client = getOpenAIClient();
  const response = await client.responses.parse({
    model,
    instructions: system,
    input: user,
    text: {
      format: zodTextFormat(IcpGenerationSchema, "icp_generation"),
    },
  });

  const output = response.output_parsed;
  if (!output) {
    throw new Error("No structured output returned from OpenAI");
  }

  return output;
}
