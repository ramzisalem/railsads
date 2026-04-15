import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/db/supabase-server";
import { generateCreative, generateThreadTitle } from "@/lib/ai/services";
import { checkCreditGate, trackUsage } from "@/lib/billing/gate";
import { verifyBrandMembership } from "@/lib/auth/verify-membership";
import { parseBody, creativeGenerateSchema } from "@/lib/validation/schemas";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: body, error: validationError } = await parseBody(request, creativeGenerateSchema);
  if (validationError) return validationError;

  const { brandId, threadId, productId, icpId, templateId, angle, awareness } = body;

  const isMember = await verifyBrandMembership(supabase, user.id, brandId);
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const gateResponse = await checkCreditGate(brandId, "creative_generation");
  if (gateResponse) return gateResponse;

  try {
    const { output, runId } = await generateCreative(supabase, {
      brandId,
      threadId,
      productId,
      icpId,
      templateId,
      angle,
      awareness,
      userId: user.id,
    });

    const { data: msg } = await supabase
      .from("messages")
      .insert({
        brand_id: brandId,
        thread_id: threadId,
        role: "assistant",
        content: output.recommendation,
        structured_payload: output,
        ai_run_id: runId,
        created_by: user.id,
      })
      .select("id")
      .single();

    await supabase
      .from("threads")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", threadId);

    const { data: product } = await supabase
      .from("products")
      .select("name")
      .eq("id", productId)
      .single();

    const { data: icp } = icpId
      ? await supabase.from("icps").select("title").eq("id", icpId).single()
      : { data: null };

    try {
      const title = await generateThreadTitle(supabase, {
        brandId,
        threadId,
        productName: product?.name ?? "Creative",
        icpTitle: icp?.title,
        angle: angle ?? undefined,
        firstMessage: output.hooks[0],
        userId: user.id,
      });
      const { error: titleUpdateError } = await supabase
        .from("threads")
        .update({ title })
        .eq("id", threadId);
      if (titleUpdateError) {
        console.error("Failed to persist thread title:", titleUpdateError);
      }
    } catch (titleErr) {
      console.error("Thread title generation or update failed:", titleErr);
    }

    await trackUsage({
      brandId,
      eventType: "creative_generation",
      userId: user.id,
      threadId,
      aiRunId: runId ?? undefined,
    });

    return NextResponse.json({
      messageId: msg?.id,
      output,
      runId,
    });
  } catch (error) {
    console.error("Creative generation failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Generation failed",
      },
      { status: 500 }
    );
  }
}
