import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BrandContext,
  ProductContext,
  IcpContext,
  TemplateContext,
  CompetitorAdContext,
  CompetitorInsightForPrompt,
} from "./prompts";

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
      .select("primary_color, secondary_color, accent_color, style_tags")
      .eq("brand_id", brandId)
      .single(),
  ]);

  const brand = brandResult.data;
  const profile = profileResult.data;
  const visual = visualResult.data;

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
 * Fetches compact template context for AI prompts.
 */
export async function fetchTemplateContext(
  supabase: SupabaseClient,
  templateId: string
): Promise<TemplateContext> {
  const { data: template } = await supabase
    .from("templates")
    .select("name, key, structure")
    .eq("id", templateId)
    .single();

  const structure = template?.structure as Record<string, unknown> | null;

  return {
    name: template?.name ?? "Unknown Template",
    key: template?.key ?? "unknown",
    sections: Array.isArray(structure?.sections)
      ? (structure.sections as string[])
      : [],
    guidelines: (structure?.guidelines as string) ?? "",
  };
}

/**
 * Fetches competitor ads for analysis.
 */
export async function fetchCompetitorAds(
  supabase: SupabaseClient,
  competitorId: string
): Promise<{ competitorName: string; ads: CompetitorAdContext[] }> {
  const [competitorResult, adsResult] = await Promise.all([
    supabase
      .from("competitors")
      .select("name")
      .eq("id", competitorId)
      .single(),
    supabase
      .from("competitor_ads")
      .select("title, ad_text, platform")
      .eq("competitor_id", competitorId)
      .order("created_at", { ascending: false }),
  ]);

  return {
    competitorName: competitorResult.data?.name ?? "Unknown Competitor",
    ads: (adsResult.data ?? []).map((ad) => ({
      title: ad.title ?? undefined,
      ad_text: ad.ad_text ?? undefined,
      platform: ad.platform ?? undefined,
    })),
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
 * Finds the latest assistant structured payload for revision context.
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
  const { data: message } = await supabase
    .from("messages")
    .select("structured_payload")
    .eq("thread_id", threadId)
    .eq("role", "assistant")
    .not("structured_payload", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!message?.structured_payload) return null;

  const p = message.structured_payload as Record<string, unknown>;
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
