import type { SupabaseClient } from "@supabase/supabase-js";
import { CREDIT_COSTS, PLAN_CREDITS } from "./stripe";

export interface CreditBalance {
  granted: number;
  used: number;
  remaining: number;
  limit: number;
}

/**
 * Sum of every credit_ledger row for a brand within a window.
 * Used by the daily usage-reconcile cron.
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
 * Why a billing decision blocked an action — drives the upgrade UX.
 */
export type CreditDenialReason =
  | "subscription_required"
  | "trial_exhausted"
  | "insufficient_credits";

export interface CreditState {
  /** Whatever the brand has left (all-time sum of ledger deltas). */
  remaining: number;
  /** Positive deltas inside the active period (subscription period or this calendar month). */
  grantedThisPeriod: number;
  /** Absolute value of negative deltas inside the active period. */
  usedThisPeriod: number;
  /** Plan monthly limit, or total trial allowance if no plan, or 0 if neither. */
  limitPerPeriod: number;
  /** True iff there's a billing-active subscription row. */
  hasSubscription: boolean;
  /** True iff the brand has any positive `trial_grant` row. */
  hasTrial: boolean;
  /** Active subscription period boundaries (null without subscription). */
  periodStart: Date | null;
  periodEnd: Date | null;
}

/**
 * Single source of truth for "what does this brand currently have available
 * to spend?". Combines subscription state, trial grants, and the immutable
 * ledger so every gate / UI surface answers the same question.
 */
export async function getCreditState(
  admin: SupabaseClient,
  brandId: string
): Promise<CreditState> {
  const [allDeltas, sub, trialRows] = await Promise.all([
    admin.from("credit_ledger").select("delta").eq("brand_id", brandId),
    getActiveSubscription(admin, brandId),
    admin
      .from("credit_ledger")
      .select("delta")
      .eq("brand_id", brandId)
      .eq("reason", "trial_grant"),
  ]);

  const remaining = (allDeltas.data ?? []).reduce(
    (s, r) => s + (r.delta as number),
    0
  );

  let periodStart: Date | null = null;
  let periodEnd: Date | null = null;
  if (sub?.current_period_start && sub.current_period_end) {
    periodStart = new Date(sub.current_period_start);
    periodEnd = new Date(sub.current_period_end);
  } else {
    const now = new Date();
    periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    periodEnd = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999
    );
  }

  const { data: periodEntries } = await admin
    .from("credit_ledger")
    .select("delta")
    .eq("brand_id", brandId)
    .gte("created_at", periodStart.toISOString())
    .lte("created_at", periodEnd.toISOString());

  let grantedThisPeriod = 0;
  let usedThisPeriod = 0;
  for (const entry of periodEntries ?? []) {
    const d = entry.delta as number;
    if (d > 0) grantedThisPeriod += d;
    else usedThisPeriod += Math.abs(d);
  }

  let limitPerPeriod = 0;
  if (sub?.plan_id) {
    const { data: plan } = await admin
      .from("plans")
      .select("monthly_credit_limit")
      .eq("id", sub.plan_id)
      .single();
    limitPerPeriod = plan?.monthly_credit_limit ?? 0;
  } else {
    limitPerPeriod = (trialRows.data ?? []).reduce(
      (s, r) => s + (r.delta as number),
      0
    );
  }

  const hasSubscription = sub !== null;
  const hasTrial = (trialRows.data?.length ?? 0) > 0;

  return {
    remaining,
    grantedThisPeriod,
    usedThisPeriod,
    limitPerPeriod,
    hasSubscription,
    hasTrial,
    periodStart: sub ? periodStart : null,
    periodEnd: sub ? periodEnd : null,
  };
}

/**
 * Decide if a brand can run an action and what to tell them if not.
 * Free actions (cost=0, e.g. iteration) are always allowed.
 */
export async function canPerformAction(
  admin: SupabaseClient,
  brandId: string,
  eventType: string
): Promise<{
  allowed: boolean;
  cost: number;
  remaining: number;
  reason: CreditDenialReason | null;
}> {
  const cost = CREDIT_COSTS[eventType] ?? 0;

  if (cost === 0) {
    return { allowed: true, cost: 0, remaining: -1, reason: null };
  }

  const state = await getCreditState(admin, brandId);

  if (state.remaining >= cost) {
    return {
      allowed: true,
      cost,
      remaining: state.remaining,
      reason: null,
    };
  }

  let reason: CreditDenialReason;
  if (state.hasSubscription) {
    reason = "insufficient_credits";
  } else if (state.hasTrial) {
    reason = "trial_exhausted";
  } else {
    reason = "subscription_required";
  }

  return {
    allowed: false,
    cost,
    remaining: state.remaining,
    reason,
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

  // Idempotency — if we've already granted for this subscription + period,
  // skip silently. Multiple webhook events (checkout.session.completed,
  // customer.subscription.created, invoice.paid) can fire for the same
  // billing cycle and we must only credit once.
  const periodStartIso = periodStart.toISOString().split("T")[0];
  const { data: existing } = await admin
    .from("credit_ledger")
    .select("id")
    .eq("brand_id", brandId)
    .eq("subscription_id", subscriptionId)
    .eq("reason", "monthly_grant")
    .eq("period_start", periodStartIso)
    .maybeSingle();

  if (existing) return existing.id;

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

/**
 * One-time trial grant — issued the first time a brand is created.
 * Idempotent: skips when a `trial_grant` already exists for the brand.
 */
export const TRIAL_CREDITS = 100;

export async function grantTrialCreditsIfMissing(
  admin: SupabaseClient,
  brandId: string,
  metadata: Record<string, unknown> = {}
): Promise<string | null> {
  const { data: existing } = await admin
    .from("credit_ledger")
    .select("id")
    .eq("brand_id", brandId)
    .eq("reason", "trial_grant")
    .maybeSingle();

  if (existing) return existing.id;

  return grantCredits(admin, {
    brandId,
    amount: TRIAL_CREDITS,
    reason: "trial_grant",
    metadata: { source: "brand_creation", ...metadata },
  });
}

async function getActiveSubscription(
  admin: SupabaseClient,
  brandId: string
): Promise<{
  id: string;
  current_period_start: string | null;
  current_period_end: string | null;
  plan_id: string | null;
} | null> {
  const { data } = await admin
    .from("subscriptions")
    .select("id, current_period_start, current_period_end, plan_id")
    .eq("brand_id", brandId)
    .in("status", ["active", "trialing", "past_due"])
    .maybeSingle();

  return data ?? null;
}
