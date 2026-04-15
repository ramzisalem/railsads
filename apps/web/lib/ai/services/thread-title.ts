import type { SupabaseClient } from "@supabase/supabase-js";
import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAIClient, getModel } from "../provider";
import { ThreadTitleSchema } from "../schemas";
import { buildThreadTitlePrompt, PROMPT_VERSIONS } from "../prompts";
import { createAiRun, completeAiRun, failAiRun } from "../tracking";

export interface GenerateThreadTitleParams {
  brandId: string;
  threadId: string;
  productName: string;
  icpTitle?: string;
  angle?: string;
  firstMessage?: string;
  userId: string;
}

export async function generateThreadTitle(
  supabase: SupabaseClient,
  params: GenerateThreadTitleParams
): Promise<string> {
  const model = getModel("efficient");

  const runId = await createAiRun(supabase, {
    brandId: params.brandId,
    threadId: params.threadId,
    serviceType: "thread_title",
    model,
    promptVersion: PROMPT_VERSIONS.thread_title,
    userId: params.userId,
  });

  try {
    const { system, user } = buildThreadTitlePrompt({
      productName: params.productName,
      icpTitle: params.icpTitle,
      angle: params.angle,
      firstMessage: params.firstMessage,
    });

    const client = getOpenAIClient();
    const response = await client.responses.parse({
      model,
      instructions: system,
      input: user,
      text: {
        format: zodTextFormat(ThreadTitleSchema, "thread_title"),
      },
    });

    const output = response.output_parsed;
    const title = output?.title ?? params.productName;

    if (runId) {
      await completeAiRun(supabase, runId, {
        inputTokens: response.usage?.input_tokens,
        outputTokens: response.usage?.output_tokens,
        totalTokens: response.usage?.total_tokens,
        responsePayload: { title },
      });
    }

    return title;
  } catch (error) {
    if (runId) {
      await failAiRun(
        supabase,
        runId,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
    return params.productName;
  }
}
