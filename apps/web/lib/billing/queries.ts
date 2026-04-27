import { createClient } from "@/lib/db/supabase-server";
import { createAdminClient } from "@/lib/db/supabase-admin";
import { getCreditState } from "./credits";

export interface PlanInfo {
  code: string;
  name: string;
  monthlyPriceCents: number;
  monthlyCreditLimit: number;
  maxBrands: number | null;
  features: Record<string, boolean>;
}

export interface SubscriptionInfo {
  id: string;
  status: string;
  plan: PlanInfo | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  trialEnd: string | null;
}

export interface UsageInfo {
  creditsGranted: number;
  creditsUsed: number;
  creditsRemaining: number;
  creditsLimit: number;
  creativeGenerations: number;
  imageGenerations: number;
  icpGenerations: number;
  competitorAnalyses: number;
  websiteImports: number;
}

export interface BillingInvoiceInfo {
  id: string;
  stripeInvoiceId: string;
  amountPaidCents: number | null;
  currency: string | null;
  status: string | null;
  hostedInvoiceUrl: string | null;
  invoicePdfUrl: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  createdAt: string;
}

export type CreditHistoryReason =
  | "monthly_grant"
  | "trial_grant"
  | "manual_adjustment"
  | "usage_deduction"
  | "refund"
  | "bonus";

export type CreditHistoryEventType =
  | "website_import"
  | "icp_generation"
  | "competitor_analysis"
  | "creative_generation"
  | "creative_revision"
  | "image_generation"
  | "export";

export interface CreditHistoryEntry {
  id: string;
  createdAt: string;
  delta: number;
  reason: CreditHistoryReason;
  /** Present for `usage_deduction` rows. */
  eventType: CreditHistoryEventType | null;
  /** Studio thread the deduction came from, if any. */
  thread: { id: string; title: string | null } | null;
  /** Plan code (for monthly_grant rows). */
  planCode: string | null;
  /** Free-form note we attach in metadata at write time. */
  note: string | null;
}

export interface BillingOverview {
  subscription: SubscriptionInfo | null;
  usage: UsageInfo;
  plans: PlanInfo[];
  hasSubscription: boolean;
  hasTrial: boolean;
  /** The state the upgrade UI should react to. */
  state: "subscribed" | "trial" | "trial_exhausted" | "no_subscription";
}

export async function getBillingOverview(
  brandId: string
): Promise<BillingOverview> {
  const supabase = await createClient();
  const admin = createAdminClient();

  const [subResult, rollupResult, plansResult, creditState] = await Promise.all([
    supabase
      .from("subscriptions")
      .select(
        `
        id,
        status,
        current_period_start,
        current_period_end,
        cancel_at_period_end,
        trial_end,
        plans:plan_id (
          code,
          name,
          monthly_price_cents,
          monthly_credit_limit,
          max_brands,
          features
        )
      `
      )
      .eq("brand_id", brandId)
      .in("status", ["active", "trialing", "past_due"])
      .maybeSingle(),

    supabase
      .from("usage_monthly_rollups")
      .select(
        "credits_granted, credits_used, creative_generations, image_generations, icp_generations, competitor_analyses, website_imports"
      )
      .eq("brand_id", brandId)
      .eq("month", getMonthKey(new Date()))
      .maybeSingle(),

    supabase
      .from("plans")
      .select(
        "code, name, monthly_price_cents, monthly_credit_limit, max_brands, features"
      )
      .eq("is_active", true)
      .eq("is_public", true)
      .order("monthly_price_cents", { ascending: true }),

    getCreditState(admin, brandId),
  ]);

  let subscription: SubscriptionInfo | null = null;
  if (subResult.data) {
    const sub = subResult.data;
    const planData = sub.plans as unknown as {
      code: string;
      name: string;
      monthly_price_cents: number;
      monthly_credit_limit: number;
      max_brands: number | null;
      features: Record<string, boolean>;
    } | null;

    subscription = {
      id: sub.id,
      status: sub.status,
      plan: planData
        ? {
            code: planData.code,
            name: planData.name,
            monthlyPriceCents: planData.monthly_price_cents,
            monthlyCreditLimit: planData.monthly_credit_limit,
            maxBrands: planData.max_brands,
            features: planData.features,
          }
        : null,
      currentPeriodStart: sub.current_period_start,
      currentPeriodEnd: sub.current_period_end,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      trialEnd: sub.trial_end,
    };
  }

  const rollup = rollupResult.data;
  const usage: UsageInfo = {
    creditsGranted: creditState.grantedThisPeriod,
    creditsUsed: creditState.usedThisPeriod,
    creditsRemaining: Math.max(creditState.remaining, 0),
    creditsLimit: creditState.limitPerPeriod,
    creativeGenerations: rollup?.creative_generations ?? 0,
    imageGenerations: rollup?.image_generations ?? 0,
    icpGenerations: rollup?.icp_generations ?? 0,
    competitorAnalyses: rollup?.competitor_analyses ?? 0,
    websiteImports: rollup?.website_imports ?? 0,
  };

  const plans: PlanInfo[] = (plansResult.data ?? []).map((p) => ({
    code: p.code,
    name: p.name,
    monthlyPriceCents: p.monthly_price_cents,
    monthlyCreditLimit: p.monthly_credit_limit,
    maxBrands: p.max_brands,
    features: p.features as Record<string, boolean>,
  }));

  let state: BillingOverview["state"];
  if (subscription) {
    state = "subscribed";
  } else if (creditState.hasTrial && creditState.remaining > 0) {
    state = "trial";
  } else if (creditState.hasTrial) {
    state = "trial_exhausted";
  } else {
    state = "no_subscription";
  }

  return {
    subscription,
    usage,
    plans,
    hasSubscription: subscription !== null,
    hasTrial: creditState.hasTrial,
    state,
  };
}

export async function getCreditHistory(
  brandId: string,
  limit = 50
): Promise<CreditHistoryEntry[]> {
  const supabase = await createClient();

  const { data: ledger, error: ledgerError } = await supabase
    .from("credit_ledger")
    .select("id, created_at, delta, reason, usage_event_id, metadata")
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (ledgerError || !ledger) {
    return [];
  }

  // The credit_ledger -> usage_events relationship is enforced by app code
  // (no FK on credit_ledger.usage_event_id), so we fetch the joined rows in
  // a second query and stitch them together.
  const usageEventIds = ledger
    .map((r) => r.usage_event_id as string | null)
    .filter((id): id is string => Boolean(id));

  let usageEventMap = new Map<
    string,
    {
      event_type: CreditHistoryEventType;
      thread: { id: string; title: string | null } | null;
    }
  >();

  if (usageEventIds.length > 0) {
    const { data: events } = await supabase
      .from("usage_events")
      .select("id, event_type, thread:threads(id, title)")
      .in("id", usageEventIds);

    usageEventMap = new Map(
      ((events ?? []) as unknown as Array<{
        id: string;
        event_type: CreditHistoryEventType;
        // PostgREST returns the embed as an array even for to-one FKs, so
        // we normalise both shapes here.
        thread:
          | { id: string; title: string | null }
          | { id: string; title: string | null }[]
          | null;
      }>).map((e) => {
        const thread = Array.isArray(e.thread) ? e.thread[0] ?? null : e.thread;
        return [e.id, { event_type: e.event_type, thread }] as const;
      })
    );
  }

  return ledger.map((row) => {
    const usageEvent = row.usage_event_id
      ? (usageEventMap.get(row.usage_event_id as string) ?? null)
      : null;
    const metadata = (row.metadata ?? {}) as Record<string, unknown>;

    return {
      id: row.id as string,
      createdAt: row.created_at as string,
      delta: row.delta as number,
      reason: row.reason as CreditHistoryReason,
      eventType: usageEvent?.event_type ?? null,
      thread: usageEvent?.thread ?? null,
      planCode:
        typeof metadata.plan === "string" ? (metadata.plan as string) : null,
      note:
        typeof metadata.note === "string" ? (metadata.note as string) : null,
    };
  });
}

export async function getBillingInvoices(
  brandId: string,
  limit = 12
): Promise<BillingInvoiceInfo[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("billing_invoices")
    .select(
      "id, stripe_invoice_id, amount_paid_cents, currency, status, hosted_invoice_url, invoice_pdf_url, period_start, period_end, created_at"
    )
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((row) => ({
    id: row.id,
    stripeInvoiceId: row.stripe_invoice_id,
    amountPaidCents: row.amount_paid_cents,
    currency: row.currency,
    status: row.status,
    hostedInvoiceUrl: row.hosted_invoice_url,
    invoicePdfUrl: row.invoice_pdf_url,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    createdAt: row.created_at,
  }));
}

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}
