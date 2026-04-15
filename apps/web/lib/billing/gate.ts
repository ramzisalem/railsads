import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/db/supabase-admin";
import { canPerformAction } from "./credits";
import { logUsageAndDeduct } from "./usage";
import { CREDIT_COSTS } from "./stripe";

/**
 * Check if a brand has enough credits for an action.
 * Returns a NextResponse error if insufficient, or null if OK.
 */
export async function checkCreditGate(
  brandId: string,
  eventType: string
): Promise<NextResponse | null> {
  const cost = CREDIT_COSTS[eventType] ?? 0;
  if (cost === 0) return null;

  const admin = createAdminClient();
  const { allowed, remaining } = await canPerformAction(
    admin,
    brandId,
    eventType
  );

  if (!allowed) {
    return NextResponse.json(
      {
        error: "insufficient_credits",
        message: "You've reached your monthly credit limit. Please upgrade your plan to continue.",
        remaining,
        cost,
      },
      { status: 402 }
    );
  }

  return null;
}

/**
 * Track usage and deduct credits after a successful AI operation.
 */
export async function trackUsage(params: {
  brandId: string;
  eventType: string;
  userId: string;
  threadId?: string;
  aiRunId?: string;
}): Promise<void> {
  const admin = createAdminClient();
  await logUsageAndDeduct(admin, {
    brandId: params.brandId,
    eventType: params.eventType,
    userId: params.userId,
    threadId: params.threadId,
    aiRunId: params.aiRunId,
  });
}
