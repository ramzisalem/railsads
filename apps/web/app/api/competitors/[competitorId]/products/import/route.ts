import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/db/supabase-server";
import { importCompetitorProducts } from "@/lib/ai/services";
import { checkCreditGate, safeTrackUsage } from "@/lib/billing/gate";
import { verifyBrandMembership } from "@/lib/auth/verify-membership";
import { parseBody, competitorProductsImportSchema } from "@/lib/validation/schemas";
import { resolveSiteAbsoluteUrl } from "@/lib/onboarding/resolve-site-url";

/**
 * Imports products from a competitor's website using the same pipeline as
 * brand import (PDP discovery, vision-based pack-shot selection, structured
 * price extraction). Unlike brand import, this endpoint returns a preview —
 * the client decides which products to keep and POSTs them back to the
 * sibling /save route.
 *
 * Costs the same `website_import` credits as a brand import.
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
    competitorProductsImportSchema
  );
  if (validationError) return validationError;

  const { brandId, websiteUrl } = body;

  const isMember = await verifyBrandMembership(supabase, user.id, brandId);
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Verify competitor belongs to this brand (RLS protects too, but explicit
  // check gives a clearer 404 vs. silent empty result).
  const { data: competitor } = await supabase
    .from("competitors")
    .select("id, brand_id")
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

  const gateResponse = await checkCreditGate(brandId, "website_import");
  if (gateResponse) return gateResponse;

  try {
    const { products, websiteUrl: normalizedUrl, siteOrigin } =
      await importCompetitorProducts({
        supabase,
        websiteUrl,
        brandId,
        userId: user.id,
      });

    void safeTrackUsage({
      brandId,
      eventType: "website_import",
      userId: user.id,
    });

    return NextResponse.json({
      products: products.map((p) => ({
        ...p,
        product_url: resolveSiteAbsoluteUrl(p.product_url, normalizedUrl),
        image_url: resolveSiteAbsoluteUrl(p.image_url, normalizedUrl),
      })),
      websiteUrl: normalizedUrl,
      siteOrigin,
    });
  } catch (error) {
    console.error("Competitor product import failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Competitor product import failed",
      },
      { status: 500 }
    );
  }
}
