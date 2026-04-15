import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/db/supabase-server";
import { reviseCreative } from "@/lib/ai/services";
import { verifyBrandMembership } from "@/lib/auth/verify-membership";
import { checkCreditGate, trackUsage } from "@/lib/billing/gate";
import { parseBody, creativeReviseSchema } from "@/lib/validation/schemas";
import { filterAllowedAttachmentUrls } from "@/lib/studio/chat-attachment-url";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: body, error: validationError } = await parseBody(request, creativeReviseSchema);
  if (validationError) return validationError;

  const { brandId, threadId, productId, icpId, userMessage, attachmentUrls } =
    body;
  const safeAttachmentUrls = filterAllowedAttachmentUrls(attachmentUrls);

  const isMember = await verifyBrandMembership(supabase, user.id, brandId);
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const gateResponse = await checkCreditGate(brandId, "creative_revision");
  if (gateResponse) return gateResponse;

  try {
    const { output, runId, modelUsed } = await reviseCreative(supabase, {
      brandId,
      threadId,
      productId,
      icpId,
      userMessage: userMessage?.trim() ?? "",
      attachmentUrls: safeAttachmentUrls,
      userId: user.id,
    });

    const { data: msg } = await supabase
      .from("messages")
      .insert({
        brand_id: brandId,
        thread_id: threadId,
        role: "assistant",
        content: output.change_summary,
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

    trackUsage({
      brandId,
      eventType: "creative_revision",
      userId: user.id,
      threadId,
      aiRunId: runId ?? undefined,
    }).catch(() => {});

    return NextResponse.json({
      messageId: msg?.id,
      output,
      runId,
      modelUsed,
    });
  } catch (error) {
    console.error("Creative revision failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Revision failed",
      },
      { status: 500 }
    );
  }
}
