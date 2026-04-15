import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/db/supabase-admin";
import { verifyCronAuth } from "@/lib/auth/verify-cron";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Daily cron (3 AM UTC): recalculate usage_monthly_rollups.credits_used
 * from the immutable credit_ledger to correct any drift caused by
 * race conditions, failed webhook retries, or partial writes.
 */
export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();

  const { data: subs } = await admin
    .from("subscriptions")
    .select("id, brand_id")
    .in("status", ["active", "trialing"]);

  if (!subs || subs.length === 0) {
    return NextResponse.json({ reconciled: 0, month });
  }

  let reconciled = 0;
  let drifts = 0;

  for (const sub of subs) {
    const { data: ledgerRows } = await admin
      .from("credit_ledger")
      .select("delta")
      .eq("brand_id", sub.brand_id)
      .gte("created_at", monthStart)
      .lte("created_at", monthEnd);

    let granted = 0;
    let used = 0;
    for (const row of ledgerRows ?? []) {
      if (row.delta > 0) granted += row.delta;
      else used += Math.abs(row.delta);
    }

    const { data: rollup } = await admin
      .from("usage_monthly_rollups")
      .select("id, credits_used, credits_granted")
      .eq("brand_id", sub.brand_id)
      .eq("month", month)
      .single();

    if (rollup) {
      const hasDrift =
        rollup.credits_used !== used || rollup.credits_granted !== granted;
      if (hasDrift) {
        await admin
          .from("usage_monthly_rollups")
          .update({ credits_used: used, credits_granted: granted })
          .eq("id", rollup.id);
        drifts++;
      }
    } else if (granted > 0 || used > 0) {
      await admin.from("usage_monthly_rollups").insert({
        brand_id: sub.brand_id,
        month,
        credits_granted: granted,
        credits_used: used,
      });
    }

    reconciled++;
  }

  return NextResponse.json({
    reconciled,
    drifts_corrected: drifts,
    month,
    timestamp: now.toISOString(),
  });
}

