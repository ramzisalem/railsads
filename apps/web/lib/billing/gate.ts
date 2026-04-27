import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/db/supabase-admin";
import { canPerformAction, type CreditDenialReason } from "./credits";
import { logUsageAndDeduct } from "./usage";
import { CREDIT_COSTS } from "./stripe";

const DENIAL_MESSAGES: Record<CreditDenialReason, string> = {
  subscription_required:
    "Subscribe to a plan to start creating ads with RailsAds.",
  trial_exhausted:
    "You've used your free trial. Subscribe to keep creating ads.",
  insufficient_credits:
    "You've reached your monthly credit limit. Upgrade to keep creating.",
};

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
  const { allowed, remaining, reason } = await canPerformAction(
    admin,
    brandId,
    eventType
  );

  if (!allowed && reason) {
    return NextResponse.json(
      {
        error: reason,
        message: DENIAL_MESSAGES[reason],
        remaining,
        cost,
        upgradeUrl: "/billing",
      },
      { status: 402 }
    );
  }

  return null;
}

/**
 * Track usage and deduct credits after a successful AI operation.
 *
 * NOTE: This will throw if the credit ledger write fails. Most call sites
 * actually want billing to be best-effort (failing to deduct should NEVER
 * prevent the user from seeing the AI response they already paid OpenAI
 * for). Prefer `safeTrackUsage` from API routes.
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

/**
 * Fire-and-log version of `trackUsage`. Used by API routes after a
 * successful AI call: we do NOT want a failing credit ledger write to mask
 * the actual response from the user (we'd be making them retry an operation
 * we already charged OpenAI for). All errors are swallowed and logged with
 * enough context to reconcile out-of-band.
 *
 * Returns a Promise that always resolves so callers can `await` without a
 * try/catch. Use this from every API route by default.
 */
export async function safeTrackUsage(params: {
  brandId: string;
  eventType: string;
  userId: string;
  threadId?: string;
  aiRunId?: string;
}): Promise<void> {
  try {
    await trackUsage(params);
  } catch (err) {
    console.error("[safeTrackUsage] credit deduction failed", {
      brandId: params.brandId,
      eventType: params.eventType,
      aiRunId: params.aiRunId,
      threadId: params.threadId,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}
