import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BrandContext,
  ProductContext,
  IcpContext,
  TemplateContext,
  CompetitorAdContext,
  CompetitorInsightForPrompt,
  CompetitorReferenceAd,
} from "./prompts";
import {
  effectiveColorPalette,
  paletteForDb,
} from "@/lib/brand/color-palette";
import { resolveTemplateThumbnailUrl } from "@/lib/studio/template-thumbnail";

/**
 * Fetches compact brand context for AI prompts.
 * Joins brand + brand_profiles + brand_visual_identity.
 */
export async function fetchBrandContext(
  supabase: SupabaseClient,
  brandId: string
): Promise<BrandContext> {
  const [brandResult, profileResult, visualResult] = await Promise.all([
    supabase
      .from("brands")
      .select("name")
      .eq("id", brandId)
      .single(),
    supabase
      .from("brand_profiles")
      .select(
        "description, positioning, value_proposition, tone_tags, personality_tags, do_rules, dont_rules"
      )
      .eq("brand_id", brandId)
      .single(),
    supabase
      .from("brand_visual_identity")
      .select(
        "primary_color, secondary_color, accent_color, color_palette, style_tags"
      )
      .eq("brand_id", brandId)
      .single(),
  ]);

  const brand = brandResult.data;
  const profile = profileResult.data;
  const visual = visualResult.data;

  const paletteRows = paletteForDb(
    effectiveColorPalette({
      color_palette: visual?.color_palette,
      primary_color: visual?.primary_color,
      secondary_color: visual?.secondary_color,
      accent_color: visual?.accent_color,
    })
  );

  return {
    name: brand?.name ?? "Unknown Brand",
    description: profile?.description ?? undefined,
    positioning: profile?.positioning ?? undefined,
    value_proposition: profile?.value_proposition ?? undefined,
    tone_tags: profile?.tone_tags ?? [],
    personality_tags: profile?.personality_tags ?? [],
    do_rules: profile?.do_rules ?? [],
    dont_rules: profile?.dont_rules ?? [],
    primary_color: visual?.primary_color ?? undefined,
    secondary_color: visual?.secondary_color ?? undefined,
    accent_color: visual?.accent_color ?? undefined,
    color_palette: paletteRows.length ? paletteRows : undefined,
    style_tags: visual?.style_tags ?? [],
  };
}

/**
 * Fetches compact product context for AI prompts.
 */
export async function fetchProductContext(
  supabase: SupabaseClient,
  productId: string
): Promise<ProductContext> {
  const [productResult, heroResult] = await Promise.all([
    supabase
      .from("products")
      .select(
        "name, short_description, description, price_amount, price_currency, attributes"
      )
      .eq("id", productId)
      .single(),
    supabase
      .from("product_asset_links")
      .select("assets ( bucket, storage_path )")
      .eq("product_id", productId)
      .eq("role", "primary")
      .order("sort_order", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  const product = productResult.data;
  const attrs = (product?.attributes ?? {}) as Record<string, unknown>;
  const importPriceText =
    typeof attrs.import_price_text === "string"
      ? attrs.import_price_text
      : undefined;
  const hero = heroResult.data?.assets as
    | { bucket: string; storage_path: string }
    | null
    | undefined;

  let primary_image_url: string | undefined;
  if (hero?.bucket && hero?.storage_path) {
    const { data } = supabase.storage
      .from(hero.bucket)
      .getPublicUrl(hero.storage_path);
    primary_image_url = data.publicUrl;
  }

  return {
    name: product?.name ?? "Unknown Product",
    short_description: product?.short_description ?? undefined,
    description: product?.description ?? undefined,
    price:
      product?.price_amount != null
        ? `${product.price_currency ?? "USD"} ${product.price_amount}`
        : importPriceText,
    primary_image_url,
    attributes: product?.attributes ?? undefined,
  };
}

/**
 * Fetches compact ICP context for AI prompts.
 */
export async function fetchIcpContext(
  supabase: SupabaseClient,
  icpId: string
): Promise<IcpContext> {
  const { data: icp } = await supabase
    .from("icps")
    .select("title, summary, pains, desires, objections, triggers")
    .eq("id", icpId)
    .single();

  return {
    title: icp?.title ?? "Unknown Audience",
    summary: icp?.summary ?? undefined,
    pains: icp?.pains ?? [],
    desires: icp?.desires ?? [],
    objections: icp?.objections ?? [],
    triggers: icp?.triggers ?? [],
  };
}

/**
 * Fetches compact template context for AI prompts. The `thumbnail_url`
 * column always stores an absolute Supabase Storage URL (system templates
 * live in the `template-thumbnails/system/` bucket, brand templates in
 * `template-thumbnails/<brandId>/`), so the value can be passed straight
 * through to `gpt-image-1` as a layout reference.
 */
export async function fetchTemplateContext(
  supabase: SupabaseClient,
  templateId: string
): Promise<TemplateContext> {
  const { data: template } = await supabase
    .from("templates")
    .select("name, key, structure, thumbnail_url")
    .eq("id", templateId)
    .single();

  const structure = template?.structure as Record<string, unknown> | null;
  const thumbnail_url = resolveTemplateThumbnailUrl(
    supabase,
    (template?.thumbnail_url as string | null) ?? null
  );

  return {
    name: template?.name ?? "Unknown Template",
    key: template?.key ?? "unknown",
    layout: typeof structure?.layout === "string" ? structure.layout : undefined,
    sections: Array.isArray(structure?.sections)
      ? (structure.sections as string[])
      : [],
    guidelines: (structure?.guidelines as string) ?? "",
    thumbnail_url,
  };
}

/**
 * Fetches competitor ads for analysis. When `productId` is provided we scope
 * to ads explicitly mapped to that product so the analysis can answer
 * "what's working for *this* product?" rather than averaging across the
 * competitor's whole library.
 *
 * Each ad gets a stable short reference (`ad-1`, `ad-2`, …) — the prompt
 * uses these to cite evidence and the service maps them back to UUIDs.
 */
export async function fetchCompetitorAds(
  supabase: SupabaseClient,
  competitorId: string,
  options: { productId?: string | null } = {}
): Promise<{ competitorName: string; ads: CompetitorAdContext[] }> {
  let adsQuery = supabase
    .from("competitor_ads")
    .select(
      `id, title, ad_text, platform, source_url, landing_page_url, mapped_product_id, created_at,
       competitor_ad_asset_links ( assets ( bucket, storage_path ) )`
    )
    .eq("competitor_id", competitorId)
    .order("created_at", { ascending: false });

  if (options.productId) {
    adsQuery = adsQuery.eq("mapped_product_id", options.productId);
  }

  const [competitorResult, adsResult] = await Promise.all([
    supabase
      .from("competitors")
      .select("name")
      .eq("id", competitorId)
      .single(),
    adsQuery,
  ]);

  type AdRow = {
    id: string;
    title: string | null;
    ad_text: string | null;
    platform: string | null;
    source_url: string | null;
    landing_page_url: string | null;
    competitor_ad_asset_links:
      | Array<{ assets: { bucket: string; storage_path: string } | null }>
      | null;
  };

  const ads: CompetitorAdContext[] = (
    (adsResult.data ?? []) as unknown as AdRow[]
  ).map((ad, index) => {
    const link = ad.competitor_ad_asset_links?.find((l) => l.assets) ?? null;
    let image_url: string | undefined;
    if (link?.assets) {
      const { data: pub } = supabase.storage
        .from(link.assets.bucket)
        .getPublicUrl(link.assets.storage_path);
      image_url = pub.publicUrl;
    }
    return {
      id: ad.id,
      ref: `ad-${index + 1}`,
      title: ad.title ?? undefined,
      ad_text: ad.ad_text ?? undefined,
      platform: ad.platform ?? undefined,
      source_url: ad.source_url ?? undefined,
      landing_page_url: ad.landing_page_url ?? undefined,
      image_url,
    };
  });

  return {
    competitorName: competitorResult.data?.name ?? "Unknown Competitor",
    ads,
  };
}

/**
 * Fetches a single competitor ad pinned as a Studio reference. Returns the
 * ad's primary screenshot URL + copy + competitor name in a shape ready for
 * the creative / image prompts.
 */
export async function fetchCompetitorAdReference(
  supabase: SupabaseClient,
  adId: string
): Promise<CompetitorReferenceAd | null> {
  const { data: ad } = await supabase
    .from("competitor_ads")
    .select(
      `title, ad_text, platform, source_url,
       competitors!inner ( name ),
       competitor_ad_asset_links ( assets ( bucket, storage_path ) )`
    )
    .eq("id", adId)
    .maybeSingle();

  if (!ad) return null;

  const competitor = Array.isArray(ad.competitors)
    ? ad.competitors[0]
    : (ad.competitors as { name: string } | null);
  // Supabase types nested selects as `T[]` even for one-to-one foreign keys;
  // normalize so each link.assets is a single record (or null).
  const links = (ad.competitor_ad_asset_links ?? []) as unknown as Array<{
    assets:
      | { bucket: string; storage_path: string }
      | { bucket: string; storage_path: string }[]
      | null;
  }>;
  let image_url: string | null = null;
  for (const link of links) {
    const asset = Array.isArray(link.assets) ? link.assets[0] : link.assets;
    if (asset) {
      const { data: pub } = supabase.storage
        .from(asset.bucket)
        .getPublicUrl(asset.storage_path);
      image_url = pub.publicUrl;
      break;
    }
  }

  return {
    competitor_name: competitor?.name ?? "Unknown",
    title: ad.title,
    platform: ad.platform,
    ad_text: ad.ad_text,
    image_url,
    source_url: ad.source_url,
  };
}

/**
 * Fetches competitor insights for a brand to inform creative generation.
 */
export async function fetchCompetitorInsights(
  supabase: SupabaseClient,
  brandId: string
): Promise<CompetitorInsightForPrompt[]> {
  const { data: insights } = await supabase
    .from("competitor_insights")
    .select(
      "competitor_id, hook_patterns, angle_patterns, emotional_triggers, offer_patterns"
    )
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false })
    .limit(5);

  if (!insights || insights.length === 0) return [];

  const competitorIds = [
    ...new Set(insights.map((i) => i.competitor_id)),
  ];
  const { data: competitors } = await supabase
    .from("competitors")
    .select("id, name")
    .in("id", competitorIds);

  const nameMap = new Map(
    (competitors ?? []).map((c) => [c.id, c.name])
  );

  return insights.map((i) => ({
    competitor_name: nameMap.get(i.competitor_id) ?? "Unknown",
    hook_patterns: i.hook_patterns ?? [],
    angle_patterns: i.angle_patterns ?? [],
    emotional_triggers: i.emotional_triggers ?? [],
    offer_patterns: i.offer_patterns ?? [],
  }));
}

/**
 * Fetches all existing ICPs for a product (for dedup during generation).
 */
export async function fetchExistingIcps(
  supabase: SupabaseClient,
  productId: string
): Promise<IcpContext[]> {
  const { data: icps } = await supabase
    .from("icps")
    .select("title, summary, pains, desires, objections, triggers")
    .eq("product_id", productId)
    .is("archived_at", null);

  return (icps ?? []).map((icp) => ({
    title: icp.title,
    summary: icp.summary ?? undefined,
    pains: icp.pains ?? [],
    desires: icp.desires ?? [],
    objections: icp.objections ?? [],
    triggers: icp.triggers ?? [],
  }));
}

/**
 * Fetches recent conversation history for revision context.
 */
export async function fetchConversationHistory(
  supabase: SupabaseClient,
  threadId: string,
  limit = 10
): Promise<{ role: string; content: string }[]> {
  const { data: messages } = await supabase
    .from("messages")
    .select("role, content, structured_payload")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true })
    .limit(limit);

  return (messages ?? []).map((m) => {
    if (m.role === "assistant" && m.structured_payload) {
      const payload = m.structured_payload as Record<string, unknown>;
      const summary = payload.change_summary || payload.recommendation || "";
      return { role: m.role, content: `[Structured output] ${summary}` };
    }
    return { role: m.role, content: m.content ?? "" };
  });
}

/**
 * Finds the latest assistant message that actually contains a CREATIVE
 * payload (hooks/headlines/body/direction/image_prompt) — NOT a standalone
 * `generated_image` message. We scan a window of recent assistant messages
 * because, with the new auto-chain, the most recent assistant message in a
 * thread is usually the chained `generated_image` (not the copy that
 * produced it). Without this filter, `reviseCreative` and the image
 * suffix-builder would both see an empty payload and the model would lose
 * the entire prior brief.
 */
export async function fetchLatestCreativePayload(
  supabase: SupabaseClient,
  threadId: string
): Promise<{
  hooks: string[];
  headlines: string[];
  primary_texts: string[];
  creative_direction: string;
  image_prompt: string;
} | null> {
  const { data: messages } = await supabase
    .from("messages")
    .select("structured_payload")
    .eq("thread_id", threadId)
    .eq("role", "assistant")
    .not("structured_payload", "is", null)
    .order("created_at", { ascending: false })
    .limit(20);

  if (!messages?.length) return null;

  const creative = messages
    .map((m) => m.structured_payload as Record<string, unknown> | null)
    .find((p) => {
      if (!p) return false;
      return (
        (Array.isArray(p.hooks) && (p.hooks as unknown[]).length > 0) ||
        (Array.isArray(p.headlines) &&
          (p.headlines as unknown[]).length > 0) ||
        (Array.isArray(p.primary_texts) &&
          (p.primary_texts as unknown[]).length > 0) ||
        (typeof p.creative_direction === "string" &&
          p.creative_direction.length > 0) ||
        (typeof p.image_prompt === "string" && p.image_prompt.length > 0)
      );
    });

  if (!creative) return null;

  const p = creative;
  return {
    hooks: Array.isArray(p.hooks) ? (p.hooks as string[]) : [],
    headlines: Array.isArray(p.headlines) ? (p.headlines as string[]) : [],
    primary_texts: Array.isArray(p.primary_texts)
      ? (p.primary_texts as string[])
      : [],
    creative_direction: (p.creative_direction as string) ?? "",
    image_prompt: (p.image_prompt as string) ?? "",
  };
}
