import type { SupabaseClient } from "@supabase/supabase-js";
import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAIClient, getModel } from "../provider";
import { StudioChatSchema } from "../schemas";
import { buildStudioChatPrompt, PROMPT_VERSIONS } from "../prompts";
import {
  fetchBrandContext,
  fetchProductContext,
  fetchIcpContext,
} from "../context";
import { createAiRun, completeAiRun, failAiRun } from "../tracking";

export interface GenerateStudioChatParams {
  brandId: string;
  threadId: string;
  productId: string;
  icpId?: string | null;
  userMessage: string;
  userId: string;
}

export interface GenerateStudioChatResult {
  /** Plain-text reply. Persist this in `messages.content` — no structured
   *  payload is produced, so the message renders as a plain chat bubble. */
  answer: string;
  runId: string | null;
}

/**
 * Generate a free-form chat reply for the Studio. Used by starter intents
 * like "Brainstorm angles" and "Visual concept" that want a text answer
 * grounded in the brand + product + audience — not a structured ad card.
 *
 * Cheaper than `generateCreative`: runs on the efficient model tier, no
 * image layer, no multi-variant parsing. Billed as one `creative_generation`
 * event at the API route layer.
 */
export async function generateStudioChat(
  supabase: SupabaseClient,
  params: GenerateStudioChatParams
): Promise<GenerateStudioChatResult> {
  const model = getModel("efficient");

  const runId = await createAiRun(supabase, {
    brandId: params.brandId,
    threadId: params.threadId,
    serviceType: "studio_chat",
    model,
    promptVersion: PROMPT_VERSIONS.studio_chat,
    userId: params.userId,
  });

  try {
    const [brand, product, icp] = await Promise.all([
      fetchBrandContext(supabase, params.brandId),
      fetchProductContext(supabase, params.productId),
      params.icpId ? fetchIcpContext(supabase, params.icpId) : undefined,
    ]);

    const { system, user } = buildStudioChatPrompt({
      brand,
      product,
      icp,
      userMessage: params.userMessage,
    });

    const client = getOpenAIClient();
    const response = await client.responses.parse({
      model,
      instructions: system,
      input: user,
      text: {
        format: zodTextFormat(StudioChatSchema, "studio_chat"),
      },
    });

    const parsed = response.output_parsed;
    const answer = parsed?.answer?.trim();
    if (!answer) {
      throw new Error("Empty response from model");
    }

    if (runId) {
      await completeAiRun(supabase, runId, {
        inputTokens: response.usage?.input_tokens,
        outputTokens: response.usage?.output_tokens,
        totalTokens: response.usage?.total_tokens,
        responsePayload: { answer },
      });
    }

    return { answer, runId };
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
