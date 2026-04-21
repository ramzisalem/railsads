import { createClient } from "@/lib/db/supabase-server";
import { fetchPrimaryProductImageUrls } from "@/lib/products/queries";
import type {
  ThreadListItem,
  ThreadDetail,
  MessageItem,
  StudioContext,
  TemplateOption,
  ProductOption,
  IcpOption,
  CompetitorAdOption,
} from "./types";

export async function getThreadsList(
  brandId: string
): Promise<ThreadListItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("threads")
    .select(
      `id, title, status, last_message_at, created_at,
       product:products!inner(name),
       icp:icps(title)`
    )
    .eq("brand_id", brandId)
    .is("archived_at", null)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false });

  if (error || !data) return [];

  return data.map((row) => {
    const product = row.product as unknown as { name: string } | null;
    const icp = row.icp as unknown as { title: string } | null;

    return {
      id: row.id,
      title: row.title,
      product_name: product?.name ?? "Unknown product",
      icp_title: icp?.title ?? null,
      status: row.status,
      last_message_at: row.last_message_at,
      created_at: row.created_at,
    };
  });
}

export async function getThreadDetail(
  threadId: string,
  brandId: string
): Promise<ThreadDetail | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("threads")
    .select("*")
    .eq("id", threadId)
    .eq("brand_id", brandId)
    .is("archived_at", null)
    .single();

  if (error || !data) return null;

  return data as ThreadDetail;
}

export async function getThreadMessages(
  threadId: string,
  brandId: string
): Promise<MessageItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("messages")
    .select("id, thread_id, role, content, structured_payload, created_at")
    .eq("thread_id", threadId)
    .eq("brand_id", brandId)
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  return data as MessageItem[];
}

export async function getStudioContext(
  brandId: string
): Promise<StudioContext> {
  const supabase = await createClient();

  const [productsResult, icpsResult, templatesResult, competitorAdsResult] =
    await Promise.all([
      supabase
        .from("products")
        .select("id, name, short_description")
        .eq("brand_id", brandId)
        .is("deleted_at", null)
        .order("name"),
      supabase
        .from("icps")
        .select(
          "id, title, summary, product_id, is_primary, pains, desires, objections, triggers"
        )
        .eq("brand_id", brandId)
        .is("archived_at", null)
        .order("is_primary", { ascending: false })
        .order("title"),
      supabase
        .from("templates")
        .select("id, key, name, description, category")
        .or(`brand_id.eq.${brandId},brand_id.is.null`)
        .eq("is_active", true)
        .order("name"),
      // Competitor ads usable as Studio references — keep the fetch capped
      // to avoid bloating the RSC payload for prolific brands. We sort by
      // most-recent so the picker shows fresh inspiration first.
      supabase
        .from("competitor_ads")
        .select(
          `id, competitor_id, mapped_product_id, title, ad_text, platform, source_url, landing_page_url,
           competitors!inner ( name ),
           competitor_ad_asset_links ( assets ( bucket, storage_path ) )`
        )
        .eq("brand_id", brandId)
        .order("created_at", { ascending: false })
        .limit(60),
    ]);

  const productRows = productsResult.data ?? [];
  const imageMap = await fetchPrimaryProductImageUrls(
    supabase,
    productRows.map((p) => p.id)
  );

  return {
    products: productRows.map((p) => ({
      id: p.id,
      name: p.name,
      short_description: p.short_description ?? null,
      image_url: imageMap.get(p.id) ?? null,
    })) as ProductOption[],
    icps: ((icpsResult.data ?? []) as Array<{
      id: string;
      title: string;
      summary: string | null;
      product_id: string;
      is_primary: boolean;
      pains: string[] | null;
      desires: string[] | null;
      objections: string[] | null;
      triggers: string[] | null;
    }>).map((row) => ({
      id: row.id,
      title: row.title,
      summary: row.summary,
      product_id: row.product_id,
      is_primary: row.is_primary,
      pains: row.pains ?? [],
      desires: row.desires ?? [],
      objections: row.objections ?? [],
      triggers: row.triggers ?? [],
    })) as IcpOption[],
    templates: (templatesResult.data ?? []) as TemplateOption[],
    competitorAds: ((competitorAdsResult.data ?? []) as unknown as Array<{
      id: string;
      competitor_id: string;
      mapped_product_id: string | null;
      title: string | null;
      ad_text: string | null;
      platform: string | null;
      source_url: string | null;
      landing_page_url: string | null;
      competitors: { name: string } | { name: string }[] | null;
      competitor_ad_asset_links:
        | Array<{
            assets:
              | { bucket: string; storage_path: string }
              | { bucket: string; storage_path: string }[]
              | null;
          }>
        | null;
    }>).map((row) => {
      let image_url: string | null = null;
      for (const link of row.competitor_ad_asset_links ?? []) {
        const asset = Array.isArray(link.assets) ? link.assets[0] : link.assets;
        if (asset) {
          const { data: pub } = supabase.storage
            .from(asset.bucket)
            .getPublicUrl(asset.storage_path);
          image_url = pub.publicUrl;
          break;
        }
      }
      const competitor = Array.isArray(row.competitors)
        ? row.competitors[0]
        : row.competitors;
      return {
        id: row.id,
        competitor_id: row.competitor_id,
        competitor_name: competitor?.name ?? "Unknown",
        mapped_product_id: row.mapped_product_id,
        title: row.title,
        ad_text: row.ad_text,
        platform: row.platform,
        source_url: row.source_url,
        landing_page_url: row.landing_page_url,
        image_url,
      };
    }) as CompetitorAdOption[],
  };
}
