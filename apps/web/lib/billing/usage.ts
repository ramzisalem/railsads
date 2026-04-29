import type { SupabaseClient } from "@supabase/supabase-js";
import { CREDIT_COSTS } from "./stripe";
import { deductCredits } from "./credits";

export interface LogUsageParams {
  brandId: string;
  threadId?: string;
  aiRunId?: string;
  eventType: string;
  userId: string;
  metadata?: Record<string, unknown>;
}

/**
 * Log a usage event, deduct credits, and update the monthly rollup.
 * This is the single entry point for all credit-consuming actions.
 * Returns the usage event ID, or null if logging failed.
 */
export async function logUsageAndDeduct(
  admin: SupabaseClient,
  params: LogUsageParams
): Promise<{ usageEventId: string | null; creditsCharged: number }> {
  const credits = CREDIT_COSTS[params.eventType] ?? 0;

  if (credits === 0) {
    return { usageEventId: null, creditsCharged: 0 };
  }

  const { data: event, error: eventError } = await admin
    .from("usage_events")
    .insert({
      brand_id: params.brandId,
      thread_id: params.threadId ?? null,
      ai_run_id: params.aiRunId ?? null,
      event_type: params.eventType,
      credits,
      metadata: params.metadata ?? {},
      created_by: params.userId,
    })
    .select("id")
    .single();

  if (eventError || !event) {
    console.error("Failed to log usage event:", eventError);
    return { usageEventId: null, creditsCharged: 0 };
  }

  const sub = await admin
    .from("subscriptions")
    .select("id")
    .eq("brand_id", params.brandId)
    .in("status", ["active", "trialing"])
    .single();

  await deductCredits(admin, {
    brandId: params.brandId,
    subscriptionId: sub?.data?.id ?? undefined,
    usageEventId: event.id,
    amount: credits,
  });

  await updateMonthlyRollup(admin, params.brandId, params.eventType, credits);

  if (params.aiRunId) {
    await admin
      .from("ai_runs")
      .update({ credits_charged: credits })
      .eq("id", params.aiRunId);
  }

  return { usageEventId: event.id, creditsCharged: credits };
}

/**
 * Upsert the monthly rollup row for the current month.
 * Increments the credits_used counter and the specific event type counter.
 */
async function updateMonthlyRollup(
  admin: SupabaseClient,
  brandId: string,
  eventType: string,
  credits: number
): Promise<void> {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  const { data: existing } = await admin
    .from("usage_monthly_rollups")
    .select("id, credits_used, creative_generations, image_generations, icp_generations, competitor_analyses, website_imports")
    .eq("brand_id", brandId)
    .eq("month", month)
    .single();

  const counterField = EVENT_TYPE_TO_ROLLUP_FIELD[eventType];

  if (existing) {
    const update: Record<string, number> = {
      credits_used: existing.credits_used + credits,
    };
    if (counterField && counterField in existing) {
      update[counterField] = (existing[counterField as keyof typeof existing] as number) + 1;
    }

    await admin
      .from("usage_monthly_rollups")
      .update(update)
      .eq("id", existing.id);
  } else {
    const insert: Record<string, unknown> = {
      brand_id: brandId,
      month,
      credits_granted: 0,
      credits_used: credits,
    };
    if (counterField) {
      insert[counterField] = 1;
    }

    await admin.from("usage_monthly_rollups").insert(insert);
  }
}

const EVENT_TYPE_TO_ROLLUP_FIELD: Record<string, string> = {
  creative_generation: "creative_generations",
  image_generation: "image_generations",
  image_edit: "image_generations",
  icp_generation: "icp_generations",
  competitor_analysis: "competitor_analyses",
  website_import: "website_imports",
};
