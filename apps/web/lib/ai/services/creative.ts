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
  fetchCompetitorAdReference,
} from "../context";
import { createAiRun, completeAiRun, failAiRun } from "../tracking";
import { buildResponsesUserInput } from "../responses-user-input";

export interface GenerateCreativeParams {
  brandId: string;
  threadId: string;
  productId: string;
  icpId?: string | null;
  templateId?: string | null;
  angle?: string | null;
  awareness?: string | null;
  /** Public Supabase Storage URLs (chat-attachments) for visual reference */
  attachmentUrls?: string[];
  /** When set, the model also gets the competitor ad's image + copy as a
   *  composition / angle reference. */
  referenceCompetitorAdId?: string | null;
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
    const [brand, product, icp, template, competitorInsights, referenceAd] =
      await Promise.all([
        fetchBrandContext(supabase, params.brandId),
        fetchProductContext(supabase, params.productId),
        params.icpId ? fetchIcpContext(supabase, params.icpId) : undefined,
        params.templateId
          ? fetchTemplateContext(supabase, params.templateId)
          : undefined,
        fetchCompetitorInsights(supabase, params.brandId),
        params.referenceCompetitorAdId
          ? fetchCompetitorAdReference(
              supabase,
              params.referenceCompetitorAdId
            )
          : Promise.resolve(null),
      ]);

    const { system, user: userBase } = buildCreativeGenerationPrompt({
      brand,
      product,
      icp,
      template,
      angle: params.angle ?? undefined,
      awareness: params.awareness ?? undefined,
      competitorInsights:
        competitorInsights.length > 0 ? competitorInsights : undefined,
      referenceAd: referenceAd ?? undefined,
    });

    // Layer in (in this order): the competitor reference (composition anchor),
    // the selected template thumbnail (layout anchor), then any user-attached
    // images (messaging cues). The competitor reference goes FIRST when set
    // because it carries the strongest "make it like this" signal.
    const images = [
      ...(referenceAd?.image_url ? [referenceAd.image_url] : []),
      ...(template?.thumbnail_url ? [template.thumbnail_url] : []),
      ...(params.attachmentUrls ?? []),
    ];
    const noteParts: string[] = [];
    if (referenceAd?.image_url) {
      noteParts.push(
        `The first attached image is a competitor ad we want to draw composition / energy from. Match its layout vibe but render OUR product, palette, and typography.`
      );
    }
    if (template?.thumbnail_url) {
      noteParts.push(
        `An attached image shows the "${template.name}" template layout. Reproduce its structure (panels, hierarchy, callout positions) in the image_prompt — but with OUR product, palette, and copy.`
      );
    }
    if ((params.attachmentUrls ?? []).length > 0) {
      noteParts.push(
        `The user attached ${params.attachmentUrls!.length} reference image(s). Use them as visual and messaging cues for hooks, copy, and the image_prompt.`
      );
    }
    const user =
      noteParts.length > 0 ? `${userBase}\n\n${noteParts.join("\n\n")}` : userBase;

    const client = getOpenAIClient();
    const response = await client.responses.parse({
      model,
      instructions: system,
      input: buildResponsesUserInput(user, images),
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
