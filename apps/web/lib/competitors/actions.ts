"use server";

import { createClient } from "@/lib/db/supabase-server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { linkAssetToCompetitorAd } from "@/lib/competitors/asset-upload";
import { trackCompetitorEvent } from "@/lib/competitors/telemetry";

async function getAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

// ---------------------------------------------------------------------------
// Competitor CRUD
// ---------------------------------------------------------------------------

export async function createCompetitor(brandId: string, formData: FormData) {
  const { supabase, user } = await getAuth();
  if (!user) return { error: "Not authenticated" };

  const name = (formData.get("name") as string)?.trim();
  if (!name) return { error: "Competitor name is required" };

  const website_url = (formData.get("website_url") as string)?.trim() || null;
  const notes = (formData.get("notes") as string)?.trim() || null;

  const { data: competitor, error } = await supabase
    .from("competitors")
    .insert({
      brand_id: brandId,
      name,
      website_url,
      notes,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/competitors");
  return { competitorId: competitor.id };
}

export async function updateCompetitor(
  competitorId: string,
  data: {
    name?: string;
    website_url?: string | null;
    notes?: string | null;
  }
) {
  const { supabase, user } = await getAuth();
  if (!user) return { error: "Not authenticated" };

  if (data.name !== undefined && !data.name.trim()) {
    return { error: "Competitor name cannot be empty" };
  }

  const { error } = await supabase
    .from("competitors")
    .update(data)
    .eq("id", competitorId);

  if (error) return { error: error.message };

  revalidatePath(`/competitors/${competitorId}`);
  revalidatePath("/competitors");
  return { success: true };
}

export async function deleteCompetitor(competitorId: string) {
  const { supabase, user } = await getAuth();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("competitors")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", competitorId);

  if (error) return { error: error.message };

  revalidatePath("/competitors");
  redirect("/competitors");
}

// ---------------------------------------------------------------------------
// Competitor Ads CRUD
// ---------------------------------------------------------------------------

export async function createCompetitorAd(
  brandId: string,
  competitorId: string,
  formData: FormData
) {
  const { supabase, user } = await getAuth();
  if (!user) return { error: "Not authenticated" };

  const title = (formData.get("title") as string)?.trim() || null;
  const source_url = (formData.get("source_url") as string)?.trim() || null;
  const landing_page_url =
    (formData.get("landing_page_url") as string)?.trim() || null;
  const platform = (formData.get("platform") as string)?.trim() || null;
  const ad_text = (formData.get("ad_text") as string)?.trim() || null;
  const notes = (formData.get("notes") as string)?.trim() || null;
  const mapped_product_id =
    (formData.get("mapped_product_id") as string)?.trim() || null;

  const { data: ad, error } = await supabase
    .from("competitor_ads")
    .insert({
      brand_id: brandId,
      competitor_id: competitorId,
      title,
      source: "manual",
      source_url,
      landing_page_url,
      platform,
      ad_text,
      notes,
      mapped_product_id: mapped_product_id || null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath(`/competitors/${competitorId}`);
  return { adId: ad.id };
}

/**
 * Creates a competitor ad row from an extracted draft + a list of asset ids
 * already uploaded by `/api/competitors/ads/extract`. This is the main
 * "save" entrypoint for the new image / URL capture flow — keeping the
 * insert here means revalidation + RLS stay consistent with the legacy
 * manual form.
 */
export async function createCompetitorAdFromCapture(params: {
  brandId: string;
  competitorId: string;
  source: "upload" | "link" | "manual";
  assetIds: string[];
  draft: {
    title?: string | null;
    ad_text?: string | null;
    platform?: string | null;
    notes?: string | null;
    source_url?: string | null;
    landing_page_url?: string | null;
    mapped_product_id?: string | null;
  };
}) {
  const { supabase, user } = await getAuth();
  if (!user) return { error: "Not authenticated" };

  const { brandId, competitorId, source, assetIds, draft } = params;
  if (!brandId || !competitorId) return { error: "Missing brand or competitor" };

  const { data: ad, error } = await supabase
    .from("competitor_ads")
    .insert({
      brand_id: brandId,
      competitor_id: competitorId,
      source,
      title: draft.title?.trim() || null,
      ad_text: draft.ad_text?.trim() || null,
      platform: draft.platform?.trim() || null,
      notes: draft.notes?.trim() || null,
      source_url: draft.source_url?.trim() || null,
      landing_page_url: draft.landing_page_url?.trim() || null,
      mapped_product_id: draft.mapped_product_id || null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  for (const assetId of assetIds) {
    try {
      await linkAssetToCompetitorAd(supabase, {
        brandId,
        competitorAdId: ad.id,
        assetId,
      });
    } catch (linkErr) {
      console.warn("linkAssetToCompetitorAd failed", linkErr);
    }
  }

  await trackCompetitorEvent(supabase, "competitor_ad_added", {
    brandId,
    actorId: user.id,
    entityId: competitorId,
    payload: {
      ad_id: ad.id,
      source,
      asset_count: assetIds.length,
      has_landing_page: Boolean(draft.landing_page_url),
      mapped_product_id: draft.mapped_product_id ?? null,
    },
  });

  revalidatePath(`/competitors/${competitorId}`);
  return { adId: ad.id };
}

/**
 * Bulk-create text-only competitor ads from a single textarea: each non-empty
 * paragraph (separated by a blank line) becomes one ad. The first non-empty
 * line of each paragraph is the title (truncated). The full paragraph is
 * stored in `ad_text`. No vision extraction; intended for fast onboarding.
 */
export async function bulkPasteCompetitorAds(params: {
  brandId: string;
  competitorId: string;
  rawText: string;
  platform?: string | null;
  mappedProductId?: string | null;
}) {
  const { supabase, user } = await getAuth();
  if (!user) return { error: "Not authenticated" };

  const blocks = params.rawText
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);
  if (blocks.length === 0) return { error: "Nothing to import" };

  const rows = blocks.map((ad_text) => {
    const firstLine = ad_text.split(/\n/)[0]?.trim() ?? "";
    const title =
      firstLine.length > 0
        ? firstLine.slice(0, 120)
        : ad_text.slice(0, 80);
    return {
      brand_id: params.brandId,
      competitor_id: params.competitorId,
      source: "manual" as const,
      title,
      ad_text,
      platform: params.platform?.trim() || null,
      mapped_product_id: params.mappedProductId || null,
      created_by: user.id,
    };
  });

  const { data, error } = await supabase
    .from("competitor_ads")
    .insert(rows)
    .select("id");

  if (error) return { error: error.message };

  await trackCompetitorEvent(supabase, "competitor_ad_added", {
    brandId: params.brandId,
    actorId: user.id,
    entityId: params.competitorId,
    payload: {
      source: "bulk_paste",
      count: data?.length ?? 0,
      mapped_product_id: params.mappedProductId ?? null,
    },
  });

  revalidatePath(`/competitors/${params.competitorId}`);
  return { count: data?.length ?? 0 };
}

export async function deleteCompetitorAd(
  adId: string,
  competitorId: string
) {
  const { supabase, user } = await getAuth();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("competitor_ads")
    .delete()
    .eq("id", adId);

  if (error) return { error: error.message };

  revalidatePath(`/competitors/${competitorId}`);
  return { success: true };
}

// ---------------------------------------------------------------------------
// Product Mapping
// ---------------------------------------------------------------------------

export async function linkProductToCompetitor(
  brandId: string,
  competitorId: string,
  productId: string
) {
  const { supabase, user } = await getAuth();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("product_competitor_links")
    .insert({ brand_id: brandId, product_id: productId, competitor_id: competitorId });

  if (error) {
    if (error.code === "23505") return { error: "Already linked" };
    return { error: error.message };
  }

  revalidatePath(`/competitors/${competitorId}`);
  return { success: true };
}

export async function unlinkProductFromCompetitor(
  competitorId: string,
  productId: string
) {
  const { supabase, user } = await getAuth();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("product_competitor_links")
    .delete()
    .eq("competitor_id", competitorId)
    .eq("product_id", productId);

  if (error) return { error: error.message };

  revalidatePath(`/competitors/${competitorId}`);
  return { success: true };
}

export async function updateProductCompetitorLinkNotes(
  competitorId: string,
  productId: string,
  notes: string | null
) {
  const { supabase, user } = await getAuth();
  if (!user) return { error: "Not authenticated" };

  const trimmed = notes?.trim();
  const { error } = await supabase
    .from("product_competitor_links")
    .update({ notes: trimmed && trimmed.length > 0 ? trimmed : null })
    .eq("competitor_id", competitorId)
    .eq("product_id", productId);

  if (error) return { error: error.message };

  revalidatePath(`/competitors/${competitorId}`);
  return { success: true };
}

// ---------------------------------------------------------------------------
// Competitor archive / restore
// ---------------------------------------------------------------------------

export async function setCompetitorStatus(
  competitorId: string,
  status: "active" | "archived"
) {
  const { supabase, user } = await getAuth();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("competitors")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", competitorId);

  if (error) return { error: error.message };

  revalidatePath("/competitors");
  revalidatePath(`/competitors/${competitorId}`);
  return { success: true };
}
