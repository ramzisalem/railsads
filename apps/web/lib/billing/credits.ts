import type { SupabaseClient } from "@supabase/supabase-js";
import { CREDIT_COSTS, PLAN_CREDITS } from "./stripe";

export interface CreditBalance {
  granted: number;
  used: number;
  remaining: number;
  limit: number;
}

/**
 * Get the current credit balance for a brand by summing the immutable ledger.
 * Positive deltas = grants, negative deltas = deductions.
 */
export async function getCreditBalance(
  admin: SupabaseClient,
  brandId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<CreditBalance> {
  const { data: entries } = await admin
    .from("credit_ledger")
    .select("delta, reason")
    .eq("brand_id", brandId)
    .gte("created_at", periodStart.toISOString())
    .lte("created_at", periodEnd.toISOString());

  let granted = 0;
  let used = 0;

  for (const entry of entries ?? []) {
    if (entry.delta > 0) {
      granted += entry.delta;
    } else {
      used += Math.abs(entry.delta);
    }
  }

  return {
    granted,
    used,
    remaining: granted - used,
    limit: granted,
  };
}

/**
 * Check if a brand has enough credits for a specific action.
 * Returns the cost and whether the action is allowed.
 */
export async function checkCredits(
  admin: SupabaseClient,
  brandId: string
): Promise<{ remaining: number; limit: number; hasSubscription: boolean }> {
  const sub = await getActiveSubscription(admin, brandId);
  if (!sub) {
    return { remaining: 0, limit: 0, hasSubscription: false };
  }

  const balance = await getCreditBalance(
    admin,
    brandId,
    new Date(sub.current_period_start),
    new Date(sub.current_period_end)
  );

  return { remaining: balance.remaining, limit: balance.limit, hasSubscription: true };
}

/**
 * Check if a brand can perform a specific event type and return the cost.
 */
export async function canPerformAction(
  admin: SupabaseClient,
  brandId: string,
  eventType: string
): Promise<{ allowed: boolean; cost: number; remaining: number }> {
  const cost = CREDIT_COSTS[eventType] ?? 0;

  if (cost === 0) {
    return { allowed: true, cost: 0, remaining: -1 };
  }

  const { remaining, hasSubscription } = await checkCredits(admin, brandId);

  if (!hasSubscription) {
    return { allowed: true, cost, remaining: -1 };
  }

  return {
    allowed: remaining >= cost,
    cost,
    remaining,
  };
}

/**
 * Deduct credits from a brand's balance.
 * Creates an immutable ledger entry with a negative delta.
 */
export async function deductCredits(
  admin: SupabaseClient,
  params: {
    brandId: string;
    subscriptionId?: string;
    usageEventId: string;
    amount: number;
    reason?: string;
  }
): Promise<string | null> {
  const { data, error } = await admin
    .from("credit_ledger")
    .insert({
      brand_id: params.brandId,
      subscription_id: params.subscriptionId ?? null,
      usage_event_id: params.usageEventId,
      reason: "usage_deduction",
      delta: -Math.abs(params.amount),
      metadata: params.reason ? { note: params.reason } : {},
    })
    .select("id")
    .single();

  if (error) {
    console.error("Failed to deduct credits:", error);
    return null;
  }

  return data.id;
}

/**
 * Grant credits to a brand (e.g., on subscription start, monthly renewal).
 * Creates an immutable ledger entry with a positive delta.
 */
export async function grantCredits(
  admin: SupabaseClient,
  params: {
    brandId: string;
    subscriptionId?: string;
    amount: number;
    reason: "monthly_grant" | "trial_grant" | "manual_adjustment" | "refund" | "bonus";
    periodStart?: Date;
    periodEnd?: Date;
    metadata?: Record<string, unknown>;
  }
): Promise<string | null> {
  const { data, error } = await admin
    .from("credit_ledger")
    .insert({
      brand_id: params.brandId,
      subscription_id: params.subscriptionId ?? null,
      reason: params.reason,
      delta: Math.abs(params.amount),
      period_start: params.periodStart?.toISOString().split("T")[0] ?? null,
      period_end: params.periodEnd?.toISOString().split("T")[0] ?? null,
      metadata: params.metadata ?? {},
    })
    .select("id")
    .single();

  if (error) {
    console.error("Failed to grant credits:", error);
    return null;
  }

  return data.id;
}

/**
 * Grant the standard monthly credits for a plan.
 */
export async function grantMonthlyCredits(
  admin: SupabaseClient,
  brandId: string,
  planCode: string,
  subscriptionId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<string | null> {
  const amount = PLAN_CREDITS[planCode];
  if (!amount) {
    console.error(`Unknown plan code: ${planCode}`);
    return null;
  }

  return grantCredits(admin, {
    brandId,
    subscriptionId,
    amount,
    reason: "monthly_grant",
    periodStart,
    periodEnd,
    metadata: { plan: planCode },
  });
}

async function getActiveSubscription(
  admin: SupabaseClient,
  brandId: string
): Promise<{
  id: string;
  current_period_start: string;
  current_period_end: string;
  plan_id: string;
} | null> {
  const { data } = await admin
    .from("subscriptions")
    .select("id, current_period_start, current_period_end, plan_id")
    .eq("brand_id", brandId)
    .in("status", ["active", "trialing"])
    .single();

  return data ?? null;
}
