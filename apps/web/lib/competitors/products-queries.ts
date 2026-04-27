import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/db/supabase-server";

export interface CompetitorProductBrandLink {
  product_id: string;
  product_name: string;
  notes: string | null;
}

export interface CompetitorProductItem {
  id: string;
  competitor_id: string;
  brand_id: string;
  name: string;
  short_description: string | null;
  description: string | null;
  price_amount: number | null;
  price_currency: string;
  /** Original on-site price string when amount couldn't be parsed (e.g. "From $49") */
  import_price_text: string | null;
  product_url: string | null;
  image_url: string | null;
  source: string;
  created_at: string;
  updated_at: string;
  /** Brand products this competitor product competes with */
  brand_links: CompetitorProductBrandLink[];
}

/**
 * Fetches all competitor products for a competitor + a map of which brand
 * products each one competes with. Single roundtrip-by-roundtrip — we
 * batch-fetch the link rows then attach them, instead of N+1ing per product.
 */
export async function getCompetitorProducts(
  supabase: SupabaseClient,
  competitorId: string,
  brandId: string
): Promise<CompetitorProductItem[]> {
  const { data: rows, error } = await supabase
    .from("competitor_products")
    .select(
      "id, competitor_id, brand_id, name, short_description, description, price_amount, price_currency, product_url, image_url, attributes, source, created_at, updated_at"
    )
    .eq("competitor_id", competitorId)
    .eq("brand_id", brandId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error || !rows || rows.length === 0) return [];

  const productIds = rows.map((r) => r.id);

  const { data: linkRows } = await supabase
    .from("competitor_product_brand_links")
    .select("competitor_product_id, product_id, notes")
    .in("competitor_product_id", productIds);

  const brandProductIds = Array.from(
    new Set((linkRows ?? []).map((l) => l.product_id))
  );

  const nameMap = new Map<string, string>();
  if (brandProductIds.length > 0) {
    const { data: brandProducts } = await supabase
      .from("products")
      .select("id, name")
      .in("id", brandProductIds);
    for (const p of brandProducts ?? []) {
      nameMap.set(p.id, p.name);
    }
  }

  const linksByCompProduct = new Map<string, CompetitorProductBrandLink[]>();
  for (const link of linkRows ?? []) {
    const list = linksByCompProduct.get(link.competitor_product_id) ?? [];
    list.push({
      product_id: link.product_id,
      product_name: nameMap.get(link.product_id) ?? "Unknown product",
      notes: link.notes,
    });
    linksByCompProduct.set(link.competitor_product_id, list);
  }

  return rows.map((row) => {
    const r = row as typeof row & { attributes?: Record<string, unknown> | null };
    const importPrice =
      typeof r.attributes?.import_price_text === "string"
        ? r.attributes.import_price_text
        : null;
    const { attributes: _drop, ...rest } = r;
    void _drop;
    return {
      ...(rest as Omit<
        CompetitorProductItem,
        "import_price_text" | "brand_links"
      >),
      import_price_text: importPrice,
      brand_links: linksByCompProduct.get(row.id) ?? [],
    };
  });
}

/**
 * Convenience wrapper for callers that don't already have a Supabase client
 * (e.g. server components).
 */
export async function getCompetitorProductsForCompetitor(
  competitorId: string,
  brandId: string
): Promise<CompetitorProductItem[]> {
  const supabase = await createClient();
  return getCompetitorProducts(supabase, competitorId, brandId);
}
