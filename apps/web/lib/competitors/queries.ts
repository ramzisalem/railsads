import { createClient } from "@/lib/db/supabase-server";

export interface CompetitorListItem {
  id: string;
  name: string;
  website_url: string | null;
  status: string;
  created_at: string;
  ad_count: number;
  last_analyzed: string | null;
}

export interface CompetitorDetail {
  id: string;
  brand_id: string;
  name: string;
  website_url: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface CompetitorAd {
  id: string;
  competitor_id: string;
  mapped_product_id: string | null;
  title: string | null;
  source: string;
  source_url: string | null;
  landing_page_url: string | null;
  platform: string | null;
  ad_text: string | null;
  notes: string | null;
  created_at: string;
}

export interface CompetitorInsight {
  id: string;
  competitor_id: string | null;
  product_id: string | null;
  summary: string | null;
  hook_patterns: string[];
  angle_patterns: string[];
  emotional_triggers: string[];
  visual_patterns: string[];
  offer_patterns: string[];
  cta_patterns: string[];
  confidence_score: number | null;
  created_at: string;
}

export interface ProductOption {
  id: string;
  name: string;
}

export interface FullCompetitorData {
  competitor: CompetitorDetail;
  ads: CompetitorAd[];
  insights: CompetitorInsight[];
  linkedProducts: ProductOption[];
  allProducts: ProductOption[];
}

export async function getCompetitorsList(
  brandId: string
): Promise<CompetitorListItem[]> {
  const supabase = await createClient();

  const { data: competitors, error } = await supabase
    .from("competitors")
    .select("id, name, website_url, status, created_at")
    .eq("brand_id", brandId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error || !competitors || competitors.length === 0) return [];

  const ids = competitors.map((c) => c.id);

  const [adsResult, analysisResult] = await Promise.all([
    supabase
      .from("competitor_ads")
      .select("competitor_id")
      .in("competitor_id", ids),
    supabase
      .from("competitor_analysis_runs")
      .select("competitor_id, completed_at")
      .in("competitor_id", ids)
      .eq("status", "completed")
      .order("completed_at", { ascending: false }),
  ]);

  const adCountMap = new Map<string, number>();
  for (const row of adsResult.data ?? []) {
    adCountMap.set(row.competitor_id, (adCountMap.get(row.competitor_id) ?? 0) + 1);
  }

  const lastAnalyzedMap = new Map<string, string>();
  for (const row of analysisResult.data ?? []) {
    if (row.competitor_id && !lastAnalyzedMap.has(row.competitor_id)) {
      lastAnalyzedMap.set(row.competitor_id, row.completed_at);
    }
  }

  return competitors.map((c) => ({
    ...(c as Omit<CompetitorListItem, "ad_count" | "last_analyzed">),
    ad_count: adCountMap.get(c.id) ?? 0,
    last_analyzed: lastAnalyzedMap.get(c.id) ?? null,
  }));
}

export async function getCompetitorDetail(
  competitorId: string,
  brandId: string
): Promise<FullCompetitorData | null> {
  const supabase = await createClient();

  const { data: competitor, error } = await supabase
    .from("competitors")
    .select("*")
    .eq("id", competitorId)
    .eq("brand_id", brandId)
    .is("deleted_at", null)
    .single();

  if (error || !competitor) return null;

  const [adsResult, insightsResult, linksResult, productsResult] =
    await Promise.all([
      supabase
        .from("competitor_ads")
        .select("id, competitor_id, mapped_product_id, title, source, source_url, landing_page_url, platform, ad_text, notes, created_at")
        .eq("competitor_id", competitorId)
        .eq("brand_id", brandId)
        .order("created_at", { ascending: false }),
      supabase
        .from("competitor_insights")
        .select("*")
        .eq("competitor_id", competitorId)
        .eq("brand_id", brandId)
        .order("created_at", { ascending: false }),
      supabase
        .from("product_competitor_links")
        .select("product_id")
        .eq("competitor_id", competitorId)
        .eq("brand_id", brandId),
      supabase
        .from("products")
        .select("id, name")
        .eq("brand_id", brandId)
        .is("deleted_at", null)
        .order("name"),
    ]);

  const linkedProductIds = new Set(
    (linksResult.data ?? []).map((l) => l.product_id)
  );
  const allProducts = (productsResult.data ?? []) as ProductOption[];

  return {
    competitor: competitor as CompetitorDetail,
    ads: (adsResult.data ?? []) as CompetitorAd[],
    insights: (insightsResult.data ?? []) as CompetitorInsight[],
    linkedProducts: allProducts.filter((p) => linkedProductIds.has(p.id)),
    allProducts,
  };
}
