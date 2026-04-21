import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Returns the set of `competitor_ads.id` that have already been included
 * in at least one COMPLETED analysis run for the given scope.
 *
 *  - `productId === null`     → only "whole library" runs count
 *  - `productId === <uuid>`   → only runs scoped to that product count
 *
 * We deliberately keep these scopes separate so that an ad analyzed in a
 * "whole library" run is still considered "new" for a per-product scope
 * (and vice-versa) — those runs ask different questions and produce
 * different patterns.
 */
export async function getAnalyzedAdIds(
  supabase: SupabaseClient,
  competitorId: string,
  productId: string | null
): Promise<Set<string>> {
  let runsQuery = supabase
    .from("competitor_analysis_runs")
    .select("id")
    .eq("competitor_id", competitorId)
    .eq("status", "completed");

  if (productId === null) {
    runsQuery = runsQuery.is("product_id", null);
  } else {
    runsQuery = runsQuery.eq("product_id", productId);
  }

  const { data: runs } = await runsQuery;
  const runIds = (runs ?? []).map((r) => r.id as string);
  if (runIds.length === 0) return new Set();

  const { data: links } = await supabase
    .from("competitor_analysis_run_ads")
    .select("ad_id")
    .in("run_id", runIds);

  return new Set((links ?? []).map((l) => l.ad_id as string));
}

/**
 * Convenience: counts how many ads are "new" (not yet analyzed) for each
 * scope the analyze button might run with. Returned shape is friendly to
 * the analyze-button UI, which renders one row per scope.
 */
export async function getNewAdCountsByScope(
  supabase: SupabaseClient,
  competitorId: string,
  productIds: string[]
): Promise<{
  totalAds: number;
  whole: { total: number; new: number };
  byProduct: Record<string, { total: number; new: number }>;
}> {
  const { data: ads } = await supabase
    .from("competitor_ads")
    .select("id, mapped_product_id")
    .eq("competitor_id", competitorId);

  const allAdRows = (ads ?? []) as Array<{
    id: string;
    mapped_product_id: string | null;
  }>;
  const allAdIds = allAdRows.map((a) => a.id);

  const wholeAnalyzed = await getAnalyzedAdIds(supabase, competitorId, null);

  const byProduct: Record<string, { total: number; new: number }> = {};
  for (const pid of productIds) {
    const productAdIds = allAdRows
      .filter((a) => a.mapped_product_id === pid)
      .map((a) => a.id);
    const productAnalyzed = await getAnalyzedAdIds(
      supabase,
      competitorId,
      pid
    );
    byProduct[pid] = {
      total: productAdIds.length,
      new: productAdIds.filter((id) => !productAnalyzed.has(id)).length,
    };
  }

  return {
    totalAds: allAdIds.length,
    whole: {
      total: allAdIds.length,
      new: allAdIds.filter((id) => !wholeAnalyzed.has(id)).length,
    },
    byProduct,
  };
}
