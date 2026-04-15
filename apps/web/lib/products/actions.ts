"use server";

import { createClient } from "@/lib/db/supabase-server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

async function getAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function createProduct(brandId: string, formData: FormData) {
  const { supabase, user } = await getAuth();
  if (!user) return { error: "Not authenticated" };

  const name = (formData.get("name") as string)?.trim();
  if (!name) return { error: "Product name is required" };

  const short_description =
    (formData.get("short_description") as string)?.trim() || null;
  const description = (formData.get("description") as string)?.trim() || null;
  const priceStr = (formData.get("price_amount") as string)?.trim();
  const price_amount = priceStr ? parseFloat(priceStr) : null;
  const price_currency =
    (formData.get("price_currency") as string)?.trim() || "USD";
  const product_url =
    (formData.get("product_url") as string)?.trim() || null;

  const benefitsRaw = (formData.get("benefits") as string)?.trim() || "";
  const benefits = benefitsRaw
    .split("\n")
    .map((b) => b.trim())
    .filter(Boolean);

  const baseSlug = slugify(name);
  let slug = baseSlug;
  let attempt = 0;
  while (attempt < 10) {
    const { data: existing } = await supabase
      .from("products")
      .select("id")
      .eq("brand_id", brandId)
      .eq("slug", slug)
      .maybeSingle();
    if (!existing) break;
    attempt++;
    slug = `${baseSlug}-${attempt}`;
  }

  const { data: product, error } = await supabase
    .from("products")
    .insert({
      brand_id: brandId,
      name,
      slug,
      short_description,
      description,
      price_amount,
      price_currency,
      product_url,
      attributes: { benefits },
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/products");
  return { productId: product.id };
}

export async function updateProduct(
  productId: string,
  data: {
    name?: string;
    short_description?: string | null;
    description?: string | null;
    price_amount?: number | null;
    price_currency?: string;
    product_url?: string | null;
    attributes?: Record<string, unknown>;
  }
) {
  const { supabase, user } = await getAuth();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("products")
    .update(data)
    .eq("id", productId);

  if (error) return { error: error.message };

  revalidatePath(`/products/${productId}`);
  revalidatePath("/products");
  return { success: true };
}

export async function deleteProduct(productId: string) {
  const { supabase, user } = await getAuth();
  if (!user) return { error: "Not authenticated" };

  // Soft delete
  const { error } = await supabase
    .from("products")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", productId);

  if (error) return { error: error.message };

  revalidatePath("/products");
  redirect("/products");
}
