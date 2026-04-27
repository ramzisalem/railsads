"use server";

import { createClient } from "@/lib/db/supabase-server";
import { revalidatePath } from "next/cache";
import { parseImportPrice } from "@/lib/onboarding/parse-import-price";

async function getAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

// ---------------------------------------------------------------------------
// Competitor Product CRUD
// ---------------------------------------------------------------------------

export async function createCompetitorProductManual(
  brandId: string,
  competitorId: string,
  formData: FormData
) {
  const { supabase, user } = await getAuth();
  if (!user) return { error: "Not authenticated" };

  const name = (formData.get("name") as string)?.trim();
  if (!name) return { error: "Product name is required" };

  const short_description =
    (formData.get("short_description") as string)?.trim() || null;
  const description = (formData.get("description") as string)?.trim() || null;
  const product_url = (formData.get("product_url") as string)?.trim() || null;
  const image_url = (formData.get("image_url") as string)?.trim() || null;
  const priceText = (formData.get("price_text") as string)?.trim() || null;

  const { price_amount, price_currency } = parseImportPrice(priceText, null);
  const attributes: Record<string, unknown> = {};
  if (priceText) attributes.import_price_text = priceText;

  const { data, error } = await supabase
    .from("competitor_products")
    .insert({
      brand_id: brandId,
      competitor_id: competitorId,
      name,
      short_description,
      description,
      price_amount,
      price_currency,
      product_url,
      image_url,
      attributes,
      source: "manual",
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath(`/competitors/${competitorId}`);
  return { competitorProductId: data.id };
}

export async function updateCompetitorProduct(
  competitorProductId: string,
  competitorId: string,
  data: {
    name?: string;
    short_description?: string | null;
    description?: string | null;
    price_amount?: number | null;
    price_currency?: string | null;
    product_url?: string | null;
    image_url?: string | null;
  }
) {
  const { supabase, user } = await getAuth();
  if (!user) return { error: "Not authenticated" };

  if (data.name !== undefined && !data.name.trim()) {
    return { error: "Product name cannot be empty" };
  }

  const { error } = await supabase
    .from("competitor_products")
    .update(data)
    .eq("id", competitorProductId);

  if (error) return { error: error.message };

  revalidatePath(`/competitors/${competitorId}`);
  return { success: true };
}

export async function deleteCompetitorProduct(
  competitorProductId: string,
  competitorId: string
) {
  const { supabase, user } = await getAuth();
  if (!user) return { error: "Not authenticated" };

  // Soft-delete to mirror brand products. Hard delete would also work since
  // competitor_product_brand_links cascade on competitor_products, but soft
  // delete keeps recovery + history possible.
  const { error } = await supabase
    .from("competitor_products")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", competitorProductId);

  if (error) return { error: error.message };

  revalidatePath(`/competitors/${competitorId}`);
  return { success: true };
}

// ---------------------------------------------------------------------------
// "Competes for" link CRUD (competitor product ↔ brand product)
// ---------------------------------------------------------------------------

export async function linkCompetitorProductToBrandProduct(
  brandId: string,
  competitorId: string,
  competitorProductId: string,
  brandProductId: string
) {
  const { supabase, user } = await getAuth();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("competitor_product_brand_links")
    .insert({
      brand_id: brandId,
      competitor_product_id: competitorProductId,
      product_id: brandProductId,
    });

  if (error) {
    if (error.code === "23505") return { error: "Already linked" };
    return { error: error.message };
  }

  revalidatePath(`/competitors/${competitorId}`);
  return { success: true };
}

export async function unlinkCompetitorProductFromBrandProduct(
  competitorId: string,
  competitorProductId: string,
  brandProductId: string
) {
  const { supabase, user } = await getAuth();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("competitor_product_brand_links")
    .delete()
    .eq("competitor_product_id", competitorProductId)
    .eq("product_id", brandProductId);

  if (error) return { error: error.message };

  revalidatePath(`/competitors/${competitorId}`);
  return { success: true };
}
