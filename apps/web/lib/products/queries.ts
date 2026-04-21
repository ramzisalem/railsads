import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/db/supabase-server";

export interface ProductListItem {
  id: string;
  name: string;
  slug: string | null;
  short_description: string | null;
  price_amount: number | null;
  price_currency: string;
  /** Original on-site price string when amount could not be parsed */
  import_price_text: string | null;
  product_url: string | null;
  status: string;
  source: string;
  created_at: string;
  icp_count: number;
  /** Public URL of the primary product image (hero), if one was imported */
  image_url: string | null;
}

export interface ProductDetail {
  id: string;
  brand_id: string;
  name: string;
  slug: string | null;
  short_description: string | null;
  description: string | null;
  price_amount: number | null;
  price_currency: string;
  product_url: string | null;
  attributes: Record<string, unknown>;
  status: string;
  source: string;
  created_at: string;
  updated_at: string;
  /** Public URL of the primary product image (hero), if one was imported */
  image_url: string | null;
}

/**
 * Resolves the primary (`role = "primary"`) product image asset to a public
 * Supabase Storage URL. Returns a Map keyed by `productId` so callers can
 * batch-fetch a list of products in a single round-trip.
 */
export async function fetchPrimaryProductImageUrls(
  supabase: SupabaseClient,
  productIds: string[]
): Promise<Map<string, string>> {
  if (productIds.length === 0) return new Map();

  const { data: links } = await supabase
    .from("product_asset_links")
    .select("product_id, sort_order, assets ( bucket, storage_path )")
    .in("product_id", productIds)
    .eq("role", "primary")
    .order("sort_order", { ascending: true });

  const map = new Map<string, string>();
  for (const row of links ?? []) {
    if (map.has(row.product_id)) continue; // first (lowest sort_order) wins
    const asset = row.assets as
      | { bucket: string; storage_path: string }
      | { bucket: string; storage_path: string }[]
      | null;
    const a = Array.isArray(asset) ? asset[0] : asset;
    if (!a?.bucket || !a?.storage_path) continue;
    const { data } = supabase.storage.from(a.bucket).getPublicUrl(a.storage_path);
    if (data?.publicUrl) map.set(row.product_id, data.publicUrl);
  }
  return map;
}

export interface IcpItem {
  id: string;
  product_id: string;
  title: string;
  summary: string | null;
  pains: string[];
  desires: string[];
  objections: string[];
  triggers: string[];
  is_primary: boolean;
  source: string;
  created_at: string;
  updated_at: string;
}

export async function getProductsList(
  brandId: string
): Promise<ProductListItem[]> {
  const supabase = await createClient();

  const { data: products, error } = await supabase
    .from("products")
    .select(
      "id, name, slug, short_description, price_amount, price_currency, product_url, status, source, created_at, attributes"
    )
    .eq("brand_id", brandId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error || !products || products.length === 0) return [];

  // Batch-fetch ICP counts
  const productIds = products.map((p) => p.id);
  const { data: icpCounts } = await supabase
    .from("icps")
    .select("product_id")
    .in("product_id", productIds)
    .is("archived_at", null);

  const countMap = new Map<string, number>();
  for (const row of icpCounts ?? []) {
    countMap.set(row.product_id, (countMap.get(row.product_id) ?? 0) + 1);
  }

  const imageMap = await fetchPrimaryProductImageUrls(supabase, productIds);

  return products.map((p) => {
    const row = p as typeof p & { attributes?: Record<string, unknown> | null };
    const importPrice =
      typeof row.attributes?.import_price_text === "string"
        ? row.attributes.import_price_text
        : null;
    const { attributes: _a, ...rest } = row;
    return {
      ...(rest as Omit<
        ProductListItem,
        "icp_count" | "import_price_text" | "image_url"
      >),
      import_price_text: importPrice,
      icp_count: countMap.get(p.id) ?? 0,
      image_url: imageMap.get(p.id) ?? null,
    };
  });
}

export interface ProductCompetitorInsight {
  id: string;
  competitor_name: string;
  summary: string | null;
  hook_patterns: string[];
  angle_patterns: string[];
  emotional_triggers: string[];
  visual_patterns: string[];
  offer_patterns: string[];
  cta_patterns: string[];
  created_at: string;
}

export async function getProductDetail(
  productId: string,
  brandId: string
): Promise<{
  product: ProductDetail;
  icps: IcpItem[];
  competitorInsights: ProductCompetitorInsight[];
} | null> {
  const supabase = await createClient();

  const [productResult, icpsResult] = await Promise.all([
    supabase
      .from("products")
      .select("*")
      .eq("id", productId)
      .eq("brand_id", brandId)
      .is("deleted_at", null)
      .single(),
    supabase
      .from("icps")
      .select("id, product_id, title, summary, pains, desires, objections, triggers, is_primary, source, created_at, updated_at")
      .eq("product_id", productId)
      .eq("brand_id", brandId)
      .is("archived_at", null)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true }),
  ]);

  if (productResult.error || !productResult.data) return null;

  const { data: linkedCompetitorIds } = await supabase
    .from("product_competitor_links")
    .select("competitor_id")
    .eq("product_id", productId)
    .eq("brand_id", brandId);

  let competitorInsights: ProductCompetitorInsight[] = [];

  if (linkedCompetitorIds && linkedCompetitorIds.length > 0) {
    const cIds = linkedCompetitorIds.map((l) => l.competitor_id);

    const [insightsResult, competitorsResult] = await Promise.all([
      supabase
        .from("competitor_insights")
        .select("id, competitor_id, summary, hook_patterns, angle_patterns, emotional_triggers, visual_patterns, offer_patterns, cta_patterns, created_at")
        .eq("brand_id", brandId)
        .in("competitor_id", cIds)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("competitors")
        .select("id, name")
        .in("id", cIds)
        .is("deleted_at", null),
    ]);

    const nameMap = new Map(
      (competitorsResult.data ?? []).map((c) => [c.id, c.name])
    );

    competitorInsights = (insightsResult.data ?? []).map((i) => ({
      id: i.id,
      competitor_name: nameMap.get(i.competitor_id) ?? "Unknown",
      summary: i.summary,
      hook_patterns: i.hook_patterns ?? [],
      angle_patterns: i.angle_patterns ?? [],
      emotional_triggers: i.emotional_triggers ?? [],
      visual_patterns: i.visual_patterns ?? [],
      offer_patterns: i.offer_patterns ?? [],
      cta_patterns: i.cta_patterns ?? [],
      created_at: i.created_at,
    }));
  }

  const imageMap = await fetchPrimaryProductImageUrls(supabase, [productId]);

  return {
    product: {
      ...(productResult.data as Omit<ProductDetail, "image_url">),
      image_url: imageMap.get(productId) ?? null,
    },
    icps: (icpsResult.data as IcpItem[]) ?? [],
    competitorInsights,
  };
}
