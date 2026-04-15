import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/db/supabase-server";
import { generateImage } from "@/lib/ai/services";
import { checkCreditGate, trackUsage } from "@/lib/billing/gate";
import { verifyBrandMembership } from "@/lib/auth/verify-membership";
import { parseBody, imageGenerateSchema } from "@/lib/validation/schemas";

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: body, error: validationError } = await parseBody(request, imageGenerateSchema);
  if (validationError) return validationError;

  const { brandId, threadId, prompt, size } = body;

  const isMember = await verifyBrandMembership(supabase, user.id, brandId);
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const gateResponse = await checkCreditGate(brandId, "image_generation");
  if (gateResponse) return gateResponse;

  try {
    const { output, runId } = await generateImage(supabase, {
      brandId,
      threadId,
      prompt,
      userId: user.id,
      size,
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

    await trackUsage({
      brandId,
      eventType: "image_generation",
      userId: user.id,
      aiRunId: runId ?? undefined,
    });

    return NextResponse.json({
      imageUrl: output.imageUrl,
      assetId: output.assetId,
      runId,
    });
  } catch (error) {
    console.error("Image generation failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Image generation failed",
      },
      { status: 500 }
    );
  }
}
