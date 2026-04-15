import type { SupabaseClient } from "@supabase/supabase-js";
import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAIClient, getModel } from "../provider";
import { CreativeRevisionSchema, type CreativeRevision } from "../schemas";
import {
  buildCreativeRevisionPrompt,
  PROMPT_VERSIONS,
} from "../prompts";
import {
  fetchBrandContext,
  fetchProductContext,
  fetchIcpContext,
  fetchConversationHistory,
  fetchLatestCreativePayload,
} from "../context";
import { createAiRun, completeAiRun, failAiRun } from "../tracking";
import { buildResponsesUserInput } from "../responses-user-input";

const MAJOR_REWRITE_KEYWORDS = [
  "rewrite",
  "start over",
  "completely different",
  "new angle",
  "different audience",
  "different approach",
  "from scratch",
  "redo",
  "change everything",
];

function isMajorRewrite(userMessage: string): boolean {
  const lower = userMessage.toLowerCase();
  return MAJOR_REWRITE_KEYWORDS.some((kw) => lower.includes(kw));
}

export interface ReviseCreativeParams {
  brandId: string;
  threadId: string;
  productId: string;
  icpId?: string | null;
  userMessage: string;
  /** Public Supabase Storage URLs (chat-attachments) passed to vision */
  attachmentUrls?: string[];
  userId: string;
}

export interface ReviseCreativeResult {
  output: CreativeRevision;
  runId: string | null;
  modelUsed: string;
}

export async function reviseCreative(
  supabase: SupabaseClient,
  params: ReviseCreativeParams
): Promise<ReviseCreativeResult> {
  const tier = isMajorRewrite(params.userMessage) ? "premium" : "efficient";
  const model = getModel(tier);

  const currentCreative = await fetchLatestCreativePayload(
    supabase,
    params.threadId
  );

  if (!currentCreative) {
    throw new Error(
      "No existing creative found in this thread. Generate one first."
    );
  }

  const runId = await createAiRun(supabase, {
    brandId: params.brandId,
    threadId: params.threadId,
    serviceType: "creative_revision",
    model,
    promptVersion: PROMPT_VERSIONS.creative_revision,
    userId: params.userId,
  });

  try {
    const [brand, product, icp, conversationHistory] = await Promise.all([
      fetchBrandContext(supabase, params.brandId),
      fetchProductContext(supabase, params.productId),
      params.icpId ? fetchIcpContext(supabase, params.icpId) : undefined,
      fetchConversationHistory(supabase, params.threadId),
    ]);

    const { system, user } = buildCreativeRevisionPrompt({
      brand,
      product,
      icp,
      currentCreative,
      conversationHistory,
      userRequest: params.userMessage,
    });

    const images = params.attachmentUrls ?? [];
    const userWithRefs =
      images.length > 0
        ? `${user}\n\nThe user attached ${images.length} reference image(s) in this message. Use them to align tone, subjects, packaging, and composition in the revised copy and image_prompt.`
        : user;

    const client = getOpenAIClient();
    const response = await client.responses.parse({
      model,
      instructions: system,
      input: buildResponsesUserInput(userWithRefs, images),
      text: {
        format: zodTextFormat(
          CreativeRevisionSchema,
          "creative_revision"
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

    return { output, runId, modelUsed: model };
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
