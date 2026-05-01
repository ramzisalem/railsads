import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/db/supabase-server";
import { generateStudioChat } from "@/lib/ai/services";
import { checkCreditGate, safeTrackUsage } from "@/lib/billing/gate";
import { verifyBrandMembership } from "@/lib/auth/verify-membership";
import { parseBody, studioChatSchema } from "@/lib/validation/schemas";

/**
 * POST `/api/studio/chat`: run a free-form chat turn for the Studio. Unlike
 * `/api/creative/generate`, the response lands as a plain-text assistant
 * message (no hooks / headlines / image) so it renders as a chat bubble
 * instead of an ad card.
 *
 * Used by the empty-state "Brainstorm angles" and "Visual concept" starters
 * — and anywhere else the user wants a text answer rather than a finished
 * creative. Billed as one `creative_generation` event.
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
    studioChatSchema
  );
  if (validationError) return validationError;

  const { brandId, threadId, productId, icpId, userMessage } = body;

  const isMember = await verifyBrandMembership(supabase, user.id, brandId);
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const gateResponse = await checkCreditGate(brandId, "creative_generation");
  if (gateResponse) return gateResponse;

  try {
    const { answer, runId } = await generateStudioChat(supabase, {
      brandId,
      threadId,
      productId,
      icpId,
      userMessage,
      userId: user.id,
    });

    // Plain-text assistant message: `content` holds the reply, no
    // structured_payload so the renderer treats it as a chat bubble.
    const { data: msg } = await supabase
      .from("messages")
      .insert({
        brand_id: brandId,
        thread_id: threadId,
        role: "assistant",
        content: answer,
        structured_payload: null,
        ai_run_id: runId,
        created_by: user.id,
      })
      .select("id")
      .single();

    await supabase
      .from("threads")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", threadId);

    await safeTrackUsage({
      brandId,
      eventType: "creative_generation",
      userId: user.id,
      threadId,
      aiRunId: runId ?? undefined,
    });

    return NextResponse.json({
      messageId: msg?.id,
      answer,
      runId,
    });
  } catch (error) {
    console.error("Studio chat failed:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Chat failed",
      },
      { status: 500 }
    );
  }
}
