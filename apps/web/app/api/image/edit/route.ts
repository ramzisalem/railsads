import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/db/supabase-server";
import { generateImage } from "@/lib/ai/services";
import { checkCreditGate, safeTrackUsage } from "@/lib/billing/gate";
import { verifyBrandMembership } from "@/lib/auth/verify-membership";
import { parseBody, imageEditSchema } from "@/lib/validation/schemas";
import {
  fetchBrandContext,
  fetchIcpContext,
  fetchProductContext,
  fetchLatestCreativePayload,
} from "@/lib/ai/context";
import { buildImagePromptSuffix } from "@/lib/ai/image-prompt-suffix";

export const maxDuration = 120;

/**
 * Edits an existing generated image. The user clicks an image in chat → opens
 * the image-editor modal → types an instruction (e.g. "make the background
 * darker", "swap the kid for a girl"). We feed the original image into
 * gpt-image-1 as a reference (via `images.edit`) so the model preserves the
 * composition and only applies the requested change.
 *
 * The full thread brief (audience / angle / awareness / brand colors) is
 * always restated as a suffix so edits stay on-brief and on-brand even when
 * the user's instruction is short.
 *
 * Each edit creates two messages in the thread so the conversation/version
 * history stays intact:
 *   1. A user message recording the edit instruction.
 *   2. An assistant message with the new generated image, linked to the
 *      previous one via `parent_asset_id` + `parent_message_id`.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: body, error: validationError } = await parseBody(
    request,
    imageEditSchema
  );
  if (validationError) return validationError;

  const { brandId, threadId, parentMessageId, prompt, size } = body;

  const isMember = await verifyBrandMembership(supabase, user.id, brandId);
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const gateResponse = await checkCreditGate(brandId, "image_generation");
  if (gateResponse) return gateResponse;

  // Resolve the source image. We require the parent message to belong to the
  // same thread + brand and to actually carry a generated_image payload.
  const { data: parentMessage, error: parentError } = await supabase
    .from("messages")
    .select("id, structured_payload")
    .eq("id", parentMessageId)
    .eq("thread_id", threadId)
    .eq("brand_id", brandId)
    .maybeSingle();

  if (parentError || !parentMessage) {
    return NextResponse.json(
      { error: "Source image message not found" },
      { status: 404 }
    );
  }

  const parentPayload = parentMessage.structured_payload as
    | { generated_image?: { url?: string; asset_id?: string } }
    | null;
  const parentImage = parentPayload?.generated_image;
  if (!parentImage?.url || !parentImage?.asset_id) {
    return NextResponse.json(
      { error: "Source message does not contain a generated image" },
      { status: 400 }
    );
  }

  // Pull thread brief so the full strategy is restated for the edit too —
  // every iteration must remain on-brief, not just the first one.
  const { data: thread } = await supabase
    .from("threads")
    .select("product_id, icp_id, angle, awareness")
    .eq("id", threadId)
    .eq("brand_id", brandId)
    .maybeSingle();

  const [brand, product, icp, latestPayload] = await Promise.all([
    fetchBrandContext(supabase, brandId),
    thread?.product_id
      ? fetchProductContext(supabase, thread.product_id)
      : null,
    thread?.icp_id ? fetchIcpContext(supabase, thread.icp_id) : null,
    fetchLatestCreativePayload(supabase, threadId),
  ]);

  const suffix = buildImagePromptSuffix({
    brand,
    product,
    icp,
    angle: thread?.angle,
    awareness: thread?.awareness,
    size,
    creativeDirection: latestPayload?.creative_direction ?? null,
    preserveReference: true,
  });
  const finalPrompt = suffix
    ? `Edit the reference image: ${prompt.trim()}\n\n${suffix}`
    : `Edit the reference image: ${prompt.trim()}`;

  try {
    // Record the user's edit instruction first so the chat reads naturally.
    const { data: userMsg } = await supabase
      .from("messages")
      .insert({
        brand_id: brandId,
        thread_id: threadId,
        role: "user",
        content: prompt.trim(),
        structured_payload: {
          edit_request: {
            parent_asset_id: parentImage.asset_id,
            parent_message_id: parentMessage.id,
          },
        },
        created_by: user.id,
      })
      .select("id")
      .single();

    const { output, runId } = await generateImage(supabase, {
      brandId,
      threadId,
      prompt: finalPrompt,
      userId: user.id,
      size,
      referenceImageUrls: [parentImage.url],
    });

    const { data: assistantMsg, error: assistantError } = await supabase
      .from("messages")
      .insert({
        brand_id: brandId,
        thread_id: threadId,
        role: "assistant",
        content: `Edited image: "${prompt.trim()}"`,
        structured_payload: {
          generated_image: {
            url: output.imageUrl,
            asset_id: output.assetId,
            storage_path: output.storagePath,
            prompt,
            parent_asset_id: parentImage.asset_id,
            parent_message_id: parentMessage.id,
            edit_prompt: prompt.trim(),
          },
        },
        ai_run_id: runId,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (assistantError) {
      throw new Error(
        `Failed to record edited image message: ${assistantError.message}`
      );
    }

    await supabase
      .from("threads")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", threadId);

    await safeTrackUsage({
      brandId,
      eventType: "image_generation",
      userId: user.id,
      threadId,
      aiRunId: runId ?? undefined,
    });

    return NextResponse.json({
      imageUrl: output.imageUrl,
      assetId: output.assetId,
      messageId: assistantMsg?.id,
      userMessageId: userMsg?.id,
      runId,
    });
  } catch (error) {
    console.error("Image edit failed:", error);
    const message =
      error instanceof Error ? error.message : "Image edit failed";

    // Record failure as a system message so the thread history reflects
    // what the user attempted. We don't try to clean up the user-edit
    // message that was inserted before the generation call — leaving it in
    // place is more truthful (the user did ask for that change) and lets
    // them retry by clicking the same image again.
    await supabase
      .from("messages")
      .insert({
        brand_id: brandId,
        thread_id: threadId,
        role: "system",
        content: `Image edit failed: ${message}`,
        structured_payload: {
          error: {
            kind: "image_edit_failed",
            message,
            edit_prompt: prompt,
            parent_message_id: parentMessageId,
          },
        },
        created_by: user.id,
      })
      .then(({ error: insertErr }) => {
        if (insertErr) {
          console.error(
            "Failed to record image-edit failure message:",
            insertErr.message
          );
        }
      });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
