import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/db/supabase-server";
import { createAdminClient } from "@/lib/db/supabase-admin";
import { importBrand } from "@/lib/ai/services";
import { checkCreditGate, trackUsage } from "@/lib/billing/gate";
import { verifyBrandMembership } from "@/lib/auth/verify-membership";
import { parseBody, brandReimportSchema } from "@/lib/validation/schemas";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: body, error: validationError } = await parseBody(request, brandReimportSchema);
  if (validationError) return validationError;

  const { brandId, websiteUrl } = body;

  const isMember = await verifyBrandMembership(supabase, user.id, brandId);
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const gateResponse = await checkCreditGate(brandId, "website_import");
  if (gateResponse) return gateResponse;

  const admin = createAdminClient();

  const { data: brand } = await admin
    .from("brands")
    .select("id, name")
    .eq("id", brandId)
    .single();

  if (!brand) {
    return NextResponse.json({ error: "Brand not found" }, { status: 404 });
  }

  try {
    const { output } = await importBrand(supabase, {
      websiteUrl,
      brandId,
      userId: user.id,
    });

    await admin
      .from("brands")
      .update({
        name: output.name,
        website_url: websiteUrl.startsWith("http")
          ? websiteUrl
          : `https://${websiteUrl}`,
      })
      .eq("id", brandId);

    await admin
      .from("brand_profiles")
      .update({
        description: output.description,
        category: output.category,
        positioning: output.positioning,
        value_proposition: output.value_proposition,
        tone_tags: output.tone_tags,
        personality_tags: output.personality_tags,
        source: "website_import",
      })
      .eq("brand_id", brandId);

    await admin
      .from("brand_visual_identity")
      .update({
        primary_color: output.primary_color,
        secondary_color: output.secondary_color,
        accent_color: output.accent_color,
        style_tags: output.style_tags,
        source: "website_import",
      })
      .eq("brand_id", brandId);

    trackUsage({
      brandId,
      eventType: "website_import",
      userId: user.id,
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Brand re-import failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Brand re-import failed",
      },
      { status: 500 }
    );
  }
}
