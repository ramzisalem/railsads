import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/db/supabase-admin";
import { getStripe } from "@/lib/billing/stripe";
import { mapStripeStatus } from "@/lib/billing/stripe-status";
import { verifyCronAuth } from "@/lib/auth/verify-cron";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Monthly cron (1st of month, 4 AM UTC): sync local subscription records
 * against Stripe to catch missed webhooks. Updates status, period dates,
 * and cancellation flags.
 */
export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const stripe = getStripe();

  const { data: subs } = await admin
    .from("subscriptions")
    .select("id, brand_id, stripe_subscription_id, status, current_period_start, current_period_end, cancel_at_period_end")
    .not("stripe_subscription_id", "is", null)
    .in("status", ["active", "trialing", "past_due"]);

  if (!subs || subs.length === 0) {
    return NextResponse.json({ synced: 0, updated: 0 });
  }

  let synced = 0;
  let updated = 0;
  const errors: string[] = [];

  for (const sub of subs) {
    try {
      const stripeSub = await stripe.subscriptions.retrieve(
        sub.stripe_subscription_id
      );

      const item = stripeSub.items.data[0];
      const periodStart = item?.current_period_start ?? stripeSub.start_date;
      const periodEnd = item?.current_period_end ?? stripeSub.start_date;

      const mappedStatus = mapStripeStatus(stripeSub.status);
      const newPeriodStart = new Date(periodStart * 1000).toISOString();
      const newPeriodEnd = new Date(periodEnd * 1000).toISOString();

      const needsUpdate =
        sub.status !== mappedStatus ||
        sub.current_period_start !== newPeriodStart ||
        sub.current_period_end !== newPeriodEnd ||
        sub.cancel_at_period_end !== stripeSub.cancel_at_period_end;

      if (needsUpdate) {
        await admin
          .from("subscriptions")
          .update({
            status: mappedStatus,
            current_period_start: newPeriodStart,
            current_period_end: newPeriodEnd,
            cancel_at_period_end: stripeSub.cancel_at_period_end,
            stripe_price_id: stripeSub.items.data[0]?.price?.id ?? null,
          })
          .eq("id", sub.id);
        updated++;
      }

      synced++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      errors.push(`${sub.stripe_subscription_id}: ${msg}`);
    }
  }

  return NextResponse.json({
    synced,
    updated,
    errors: errors.length > 0 ? errors : undefined,
    timestamp: new Date().toISOString(),
  });
}

