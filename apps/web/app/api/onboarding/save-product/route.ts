import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/db/supabase-server";
import { createAdminClient } from "@/lib/db/supabase-admin";
import { parseBody, saveProductSchema } from "@/lib/validation/schemas";
import { storeProductHeroFromUrl } from "@/lib/onboarding/product-hero-image";
import { parseImportPrice } from "@/lib/onboarding/parse-import-price";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: body, error: validationError } = await parseBody(request, saveProductSchema);
  if (validationError) return validationError;

  const {
    brandId,
    name,
    shortDescription,
    description,
    priceText,
    priceCurrency,
    productUrl,
    imageUrl,
    siteOrigin,
    keyFeatures,
    productCategory,
  } = body;

  const { price_amount, price_currency } = parseImportPrice(
    priceText,
    priceCurrency
  );

  let finalProductUrl = productUrl?.trim() || null;
  const origin = siteOrigin?.trim();
  if (finalProductUrl && origin && !/^https?:\/\//i.test(finalProductUrl)) {
    try {
      const base = origin.endsWith("/") ? origin : `${origin}/`;
      finalProductUrl = new URL(finalProductUrl, base).href;
    } catch {
      /* keep relative string — DB may still store for manual fix */
    }
  }

  const benefits = (keyFeatures ?? []).map((s) => s.trim()).filter(Boolean);
  const attributes: Record<string, unknown> = {};
  if (benefits.length > 0) attributes.benefits = benefits;
  if (priceText?.trim()) attributes.import_price_text = priceText.trim();
  if (productCategory?.trim()) attributes.import_category = productCategory.trim();

  const { data: membership } = await supabase
    .from("brand_members")
    .select("id")
    .eq("brand_id", brandId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();

  const { data: product, error } = await admin
    .from("products")
    .insert({
      brand_id: brandId,
      name: name.trim(),
      short_description: shortDescription?.trim() || null,
      description: description?.trim() || null,
      price_amount,
      price_currency,
      product_url: finalProductUrl,
      attributes,
      source: "website_import",
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !product) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to save product" },
      { status: 500 }
    );
  }

  if (imageUrl?.trim()) {
    try {
      await storeProductHeroFromUrl(admin, {
        brandId,
        productId: product.id,
        userId: user.id,
        imageUrl: imageUrl.trim(),
        siteOrigin: siteOrigin?.trim() || null,
        productUrl: finalProductUrl,
      });
    } catch (e) {
      console.error("Product hero image import:", e);
    }
  }

  return NextResponse.json({ productId: product.id });
}
