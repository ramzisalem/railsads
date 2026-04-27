import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/db/supabase-server";
import { createAdminClient } from "@/lib/db/supabase-admin";
import { revalidatePath } from "next/cache";
import { parseBody, competitorProductsSaveSchema } from "@/lib/validation/schemas";
import { verifyBrandMembership } from "@/lib/auth/verify-membership";
import { parseImportPrice } from "@/lib/onboarding/parse-import-price";

/**
 * Persists a batch of competitor products previewed by `/import`.
 * Stores the original on-site price string in `attributes.import_price_text`
 * (mirrors brand products) and resolves any remaining relative URLs against
 * the supplied site origin.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ competitorId: string }> }
) {
  const { competitorId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: body, error: validationError } = await parseBody(
    request,
    competitorProductsSaveSchema
  );
  if (validationError) return validationError;

  const { brandId, products, websiteUrl } = body;

  const isMember = await verifyBrandMembership(supabase, user.id, brandId);
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: competitor } = await supabase
    .from("competitors")
    .select("id")
    .eq("id", competitorId)
    .eq("brand_id", brandId)
    .is("deleted_at", null)
    .single();

  if (!competitor) {
    return NextResponse.json(
      { error: "Competitor not found" },
      { status: 404 }
    );
  }

  let siteOrigin: string | null = null;
  if (websiteUrl) {
    try {
      siteOrigin = new URL(
        websiteUrl.startsWith("http") ? websiteUrl : `https://${websiteUrl}`
      ).origin;
    } catch {
      siteOrigin = null;
    }
  }

  function resolveAgainstOrigin(maybeRelative: string | null | undefined) {
    const raw = maybeRelative?.trim();
    if (!raw) return null;
    if (/^https?:\/\//i.test(raw)) return raw;
    if (raw.startsWith("//")) return `https:${raw}`;
    if (!siteOrigin) return raw;
    try {
      const base = siteOrigin.endsWith("/") ? siteOrigin : `${siteOrigin}/`;
      return new URL(raw, base).href;
    } catch {
      return raw;
    }
  }

  const admin = createAdminClient();

  const rows = products.map((p) => {
    const { price_amount, price_currency } = parseImportPrice(
      p.price_text ?? null,
      p.price_currency ?? null
    );

    const benefits = (p.key_features ?? [])
      .map((s) => s.trim())
      .filter(Boolean);
    const attributes: Record<string, unknown> = {};
    if (benefits.length > 0) attributes.benefits = benefits;
    if (p.price_text?.trim()) {
      attributes.import_price_text = p.price_text.trim();
    }
    if (p.product_category?.trim()) {
      attributes.import_category = p.product_category.trim();
    }

    return {
      brand_id: brandId,
      competitor_id: competitorId,
      name: p.name.trim(),
      short_description: p.short_description?.trim() || null,
      description: p.description?.trim() || null,
      price_amount,
      price_currency,
      product_url: resolveAgainstOrigin(p.product_url),
      image_url: resolveAgainstOrigin(p.image_url),
      attributes,
      source: "website_import" as const,
      created_by: user.id,
    };
  });

  const { data, error } = await admin
    .from("competitor_products")
    .insert(rows)
    .select("id");

  if (error) {
    console.error("Failed to insert competitor products:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidatePath(`/competitors/${competitorId}`);

  return NextResponse.json({
    inserted: data?.length ?? 0,
    competitorProductIds: data?.map((r) => r.id) ?? [],
  });
}
