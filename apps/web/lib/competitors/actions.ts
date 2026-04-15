"use server";

import { createClient } from "@/lib/db/supabase-server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

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
