import { createClient } from "@/lib/db/supabase-server";

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
  creativeGenerations: number;
  imageGenerations: number;
  icpGenerations: number;
  competitorAnalyses: number;
  websiteImports: number;
}

export interface BillingOverview {
  subscription: SubscriptionInfo | null;
  usage: UsageInfo;
  plans: PlanInfo[];
  hasSubscription: boolean;
}

export async function getBillingOverview(
  brandId: string
): Promise<BillingOverview> {
  const supabase = await createClient();

  const [subResult, rollupResult, plansResult] = await Promise.all([
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
      .single(),

    supabase
      .from("usage_monthly_rollups")
      .select("credits_granted, credits_used, creative_generations, image_generations, icp_generations, competitor_analyses, website_imports")
      .eq("brand_id", brandId)
      .eq("month", getMonthKey(new Date()))
      .single(),

    supabase
      .from("plans")
      .select("code, name, monthly_price_cents, monthly_credit_limit, max_brands, features")
      .eq("is_active", true)
      .eq("is_public", true)
      .order("monthly_price_cents", { ascending: true }),
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
    creditsGranted: rollup?.credits_granted ?? 0,
    creditsUsed: rollup?.credits_used ?? 0,
    creditsRemaining: (rollup?.credits_granted ?? 0) - (rollup?.credits_used ?? 0),
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

  return {
    subscription,
    usage,
    plans,
    hasSubscription: subscription !== null,
  };
}

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}
