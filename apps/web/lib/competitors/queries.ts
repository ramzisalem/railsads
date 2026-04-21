import { createClient } from "@/lib/db/supabase-server";
import { getNewAdCountsByScope } from "@/lib/competitors/analyzed-ads";

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

export interface CompetitorAdImage {
  asset_id: string;
  bucket: string;
  storage_path: string;
  public_url: string;
  width: number | null;
  height: number | null;
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
  images: CompetitorAdImage[];
}

export type CompetitorPatternCategory =
  | "hook"
  | "angle"
  | "emotional"
  | "visual"
  | "offer"
  | "cta";

export interface CompetitorInsightEvidence {
  category: CompetitorPatternCategory;
  pattern: string;
  evidence_ad_ids: string[];
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
  evidence: CompetitorInsightEvidence[];
  confidence_score: number | null;
  created_at: string;
}

export interface ProductOption {
  id: string;
  name: string;
}

export interface LinkedProductOption extends ProductOption {
  /** Free-text note on this competitor↔product overlap (why they compete,
   *  positioning differences, etc.). Edited from the ProductMapping panel. */
  link_notes: string | null;
}

/** Per-scope counts of how many ads are still un-analyzed. Drives the
 *  "Analyze N new ads" button copy and disabling. */
export interface NewAdsByScope {
  /** Whole-library scope: total ads + how many haven't been in a
   *  whole-library run yet. */
  whole: { total: number; new: number };
  /** Per-product scope keyed by product_id. Only includes products that are
   *  linked to this competitor. */
  byProduct: Record<string, { total: number; new: number }>;
}

export interface FullCompetitorData {
  competitor: CompetitorDetail;
  ads: CompetitorAd[];
  insights: CompetitorInsight[];
  linkedProducts: LinkedProductOption[];
  allProducts: ProductOption[];
  newAdCounts: NewAdsByScope;
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
        .select(
          `id, competitor_id, mapped_product_id, title, source, source_url, landing_page_url, platform, ad_text, notes, created_at,
           competitor_ad_asset_links (
             asset_id,
             role,
             assets ( id, bucket, storage_path, width, height )
           )`
        )
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
        .select("product_id, notes")
        .eq("competitor_id", competitorId)
        .eq("brand_id", brandId),
      supabase
        .from("products")
        .select("id, name")
        .eq("brand_id", brandId)
        .is("deleted_at", null)
        .order("name"),
    ]);

  const linkRows = (linksResult.data ?? []) as Array<{
    product_id: string;
    notes: string | null;
  }>;
  const noteByProductId = new Map<string, string | null>();
  for (const link of linkRows) noteByProductId.set(link.product_id, link.notes);
  const allProducts = (productsResult.data ?? []) as ProductOption[];

  type AdRow = Omit<CompetitorAd, "images"> & {
    competitor_ad_asset_links: Array<{
      asset_id: string;
      assets: {
        id: string;
        bucket: string;
        storage_path: string;
        width: number | null;
        height: number | null;
      } | null;
    }> | null;
  };

  const ads: CompetitorAd[] = ((adsResult.data ?? []) as unknown as AdRow[]).map(
    (row) => {
      const links = row.competitor_ad_asset_links ?? [];
      const images: CompetitorAdImage[] = [];
      for (const link of links) {
        if (!link.assets) continue;
        const { data: pub } = supabase.storage
          .from(link.assets.bucket)
          .getPublicUrl(link.assets.storage_path);
        images.push({
          asset_id: link.assets.id,
          bucket: link.assets.bucket,
          storage_path: link.assets.storage_path,
          public_url: pub.publicUrl,
          width: link.assets.width,
          height: link.assets.height,
        });
      }
      const { competitor_ad_asset_links: _drop, ...rest } = row;
      void _drop;
      return { ...rest, images };
    }
  );

  const linkedProducts = allProducts
    .filter((p) => noteByProductId.has(p.id))
    .map<LinkedProductOption>((p) => ({
      ...p,
      link_notes: noteByProductId.get(p.id) ?? null,
    }));

  const newAdCounts = await getNewAdCountsByScope(
    supabase,
    competitorId,
    linkedProducts.map((p) => p.id)
  );

  return {
    competitor: competitor as CompetitorDetail,
    ads,
    insights: ((insightsResult.data ?? []) as Array<
      Omit<CompetitorInsight, "evidence"> & { evidence: unknown }
    >).map((row) => ({
      ...row,
      evidence: Array.isArray(row.evidence)
        ? (row.evidence as CompetitorInsightEvidence[])
        : [],
    })),
    linkedProducts,
    allProducts,
    newAdCounts: {
      whole: newAdCounts.whole,
      byProduct: newAdCounts.byProduct,
    },
  };
}
