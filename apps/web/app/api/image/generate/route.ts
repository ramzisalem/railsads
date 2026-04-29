import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/db/supabase-server";
import { generateImage } from "@/lib/ai/services";
import { checkCreditGate, safeTrackUsage } from "@/lib/billing/gate";
import { verifyBrandMembership } from "@/lib/auth/verify-membership";
import { parseBody, imageGenerateSchema } from "@/lib/validation/schemas";
import { fetchPrimaryProductImageUrls } from "@/lib/products/queries";
import {
  fetchBrandContext,
  fetchIcpContext,
  fetchProductContext,
  fetchLatestCreativePayload,
  fetchCompetitorAdReference,
  fetchTemplateContext,
} from "@/lib/ai/context";
import { buildImagePromptSuffix } from "@/lib/ai/image-prompt-suffix";
import { trackCompetitorEvent } from "@/lib/competitors/telemetry";
import {
  visualStyleLabel,
  visualStylePromptFragment,
} from "@/lib/studio/visual-styles";

export const maxDuration = 120;

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
    imageGenerateSchema
  );
  if (validationError) return validationError;

  const { brandId, threadId, prompt, size, referenceImageUrls } = body;

  const isMember = await verifyBrandMembership(supabase, user.id, brandId);
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const gateResponse = await checkCreditGate(brandId, "image_generation");
  if (gateResponse) return gateResponse;

  // Pull the full thread brief: product (for the hero photo), audience, angle,
  // and awareness. We re-inject all of these into the gpt-image-1 prompt as a
  // deterministic suffix so they don't get diluted by the text-LLM that wrote
  // `image_prompt` originally.
  const { data: thread } = await supabase
    .from("threads")
    .select(
      "product_id, icp_id, angle, awareness, reference_competitor_ad_id, template_id, visual_style"
    )
    .eq("id", threadId)
    .eq("brand_id", brandId)
    .maybeSingle();

  // ---- Visual references ----------------------------------------------
  // Priority order:
  //   1. Product hero image (the canonical packshot)
  //   2. Recent user-attached images on this thread (most recent 3)
  //   3. Any explicit `referenceImageUrls` from the client (rarely used)
  // We cap the union at 4 to stay within sensible token / latency budgets.
  const references: string[] = [];

  if (thread?.product_id) {
    const imageMap = await fetchPrimaryProductImageUrls(supabase, [
      thread.product_id,
    ]);
    const heroUrl = imageMap.get(thread.product_id);
    if (heroUrl) references.push(heroUrl);
  }

  const { data: recentMessages } = await supabase
    .from("messages")
    .select("structured_payload")
    .eq("thread_id", threadId)
    .eq("brand_id", brandId)
    .eq("role", "user")
    .not("structured_payload", "is", null)
    .order("created_at", { ascending: false })
    .limit(6);

  for (const msg of recentMessages ?? []) {
    const payload = msg.structured_payload as
      | { attachments?: Array<{ type: string; url: string }> }
      | null;
    for (const att of payload?.attachments ?? []) {
      if (
        att?.type === "image" &&
        typeof att.url === "string" &&
        !references.includes(att.url)
      ) {
        references.push(att.url);
      }
    }
  }

  for (const url of referenceImageUrls ?? []) {
    if (!references.includes(url)) references.push(url);
  }

  // ---- Brief suffix (full thread brief restated for gpt-image-1) -----
  // We pull every signal that could affect the visual: brand identity
  // (colors, style, personality, rules), product identity (form factor /
  // category), audience persona, narrative angle, viewer awareness, and the
  // upstream LLM's `creative_direction` (which already considers all of the
  // above). The output suffix is fully role-tagged so the model can use each
  // signal as a hard anchor.
  const [brand, product, icp, latestPayload, referenceAd, template] =
    await Promise.all([
      fetchBrandContext(supabase, brandId),
      thread?.product_id
        ? fetchProductContext(supabase, thread.product_id)
        : null,
      thread?.icp_id ? fetchIcpContext(supabase, thread.icp_id) : null,
      fetchLatestCreativePayload(supabase, threadId),
      thread?.reference_competitor_ad_id
        ? fetchCompetitorAdReference(
            supabase,
            thread.reference_competitor_ad_id
          )
        : null,
      thread?.template_id
        ? fetchTemplateContext(supabase, thread.template_id)
        : null,
    ]);

  // Reference ordering matters — gpt-image-1 weights earlier images more.
  // Slot 0 = competitor screenshot (the strongest "make it like this" cue
  // when present). Slot 1 = template layout (structural anchor). Slot 2+ =
  // product hero + user attachments resolved earlier.
  if (template?.thumbnail_url && !references.includes(template.thumbnail_url)) {
    references.unshift(template.thumbnail_url);
  }
  if (referenceAd?.image_url && !references.includes(referenceAd.image_url)) {
    references.unshift(referenceAd.image_url);
  }

  const styleLabel = visualStyleLabel(thread?.visual_style);
  const stylePrompt = visualStylePromptFragment(thread?.visual_style);
  const visualStyle =
    styleLabel && stylePrompt
      ? { label: styleLabel, prompt: stylePrompt }
      : null;

  const suffix = buildImagePromptSuffix({
    brand,
    product,
    icp,
    angle: thread?.angle,
    awareness: thread?.awareness,
    visualStyle,
    size,
    creativeDirection: latestPayload?.creative_direction ?? null,
    referenceAd,
    template,
  });
  const finalPrompt = suffix ? `${prompt}\n\n${suffix}` : prompt;

  try {
    const { output, runId } = await generateImage(supabase, {
      brandId,
      threadId,
      prompt: finalPrompt,
      userId: user.id,
      size,
      referenceImageUrls: references.slice(0, 4),
    });

    await supabase.from("messages").insert({
      brand_id: brandId,
      thread_id: threadId,
      role: "assistant",
      content: `Generated image for: "${prompt}"`,
      structured_payload: {
        generated_image: {
          url: output.imageUrl,
          asset_id: output.assetId,
          storage_path: output.storagePath,
          prompt,
        },
      },
      ai_run_id: runId,
      created_by: user.id,
    });

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

    if (thread?.reference_competitor_ad_id) {
      await trackCompetitorEvent(supabase, "studio_used_competitor_reference", {
        brandId,
        actorId: user.id,
        entityId: thread.reference_competitor_ad_id,
        payload: {
          surface: "image_generation",
          thread_id: threadId,
          ai_run_id: runId ?? null,
        },
      });
    }

    return NextResponse.json({
      imageUrl: output.imageUrl,
      assetId: output.assetId,
      runId,
    });
  } catch (error) {
    console.error("Image generation failed:", error);
    const message =
      error instanceof Error ? error.message : "Image generation failed";

    // Record the failure as a system message so it survives the page refresh
    // and is visible in the thread's history (otherwise the user just sees a
    // transient toast and has no record of which prompts failed). Errors
    // during this insert are swallowed — surfacing the original failure to
    // the client is still the priority.
    await supabase
      .from("messages")
      .insert({
        brand_id: brandId,
        thread_id: threadId,
        role: "system",
        content: `Image generation failed: ${message}`,
        structured_payload: {
          error: { kind: "image_generation_failed", message, prompt },
        },
        created_by: user.id,
      })
      .then(({ error: insertErr }) => {
        if (insertErr) {
          console.error(
            "Failed to record image-generation failure message:",
            insertErr.message
          );
        }
      });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
