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
  fetchCompetitorAdReference,
} from "../context";
import { createAiRun, completeAiRun, failAiRun } from "../tracking";
import { buildResponsesUserInput } from "../responses-user-input";
import {
  visualStyleLabel,
  visualStylePromptFragment,
} from "@/lib/studio/visual-styles";

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
  /** Competitor ad pinned to this thread (used as inspiration only). */
  referenceCompetitorAdId?: string | null;
  /** Visual style preset id pinned to this thread — applied to the revised
   *  creative_direction and image_prompt aesthetic. */
  visualStyle?: string | null;
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
    const [brand, product, icp, conversationHistory, referenceAd] =
      await Promise.all([
        fetchBrandContext(supabase, params.brandId),
        fetchProductContext(supabase, params.productId),
        params.icpId ? fetchIcpContext(supabase, params.icpId) : undefined,
        fetchConversationHistory(supabase, params.threadId),
        params.referenceCompetitorAdId
          ? fetchCompetitorAdReference(
              supabase,
              params.referenceCompetitorAdId
            )
          : Promise.resolve(null),
      ]);

    const visualStyleLabelStr = visualStyleLabel(params.visualStyle);
    const visualStylePrompt = visualStylePromptFragment(params.visualStyle);
    const visualStyle =
      visualStyleLabelStr && visualStylePrompt
        ? { label: visualStyleLabelStr, prompt: visualStylePrompt }
        : undefined;

    const { system, user } = buildCreativeRevisionPrompt({
      brand,
      product,
      icp,
      currentCreative,
      conversationHistory,
      userRequest: params.userMessage,
      visualStyle,
      referenceAd: referenceAd ?? undefined,
    });

    const images = [
      ...(referenceAd?.image_url ? [referenceAd.image_url] : []),
      ...(params.attachmentUrls ?? []),
    ];
    const noteParts: string[] = [];
    if (referenceAd?.image_url) {
      noteParts.push(
        `The first attached image is the pinned competitor reference for this thread — pull composition / energy from it but never copy claims, brand marks, or pricing.`
      );
    }
    if ((params.attachmentUrls ?? []).length > 0) {
      noteParts.push(
        `The user attached ${params.attachmentUrls!.length} reference image(s) in this message. Use them to align tone, subjects, packaging, and composition in the revised copy and image_prompt.`
      );
    }
    const userWithRefs =
      noteParts.length > 0 ? `${user}\n\n${noteParts.join("\n\n")}` : user;

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
