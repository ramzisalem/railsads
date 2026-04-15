import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/db/supabase-server";
import { createAdminClient } from "@/lib/db/supabase-admin";
import { importBrand } from "@/lib/ai/services";
import { cookies } from "next/headers";
import { ACTIVE_BRAND_COOKIE } from "@/lib/auth/get-current-brand";
import { trackUsage } from "@/lib/billing/gate";
import { parseBody, brandImportSchema } from "@/lib/validation/schemas";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: body, error: validationError } = await parseBody(request, brandImportSchema);
  if (validationError) return validationError;

  const { websiteUrl } = body;

  const admin = createAdminClient();
  let createdBrandId: string | null = null;

  try {
    const tempName = new URL(
      websiteUrl.startsWith("http") ? websiteUrl : `https://${websiteUrl}`
    ).hostname.replace(/^www\./, "");

    let slug = slugify(tempName);
    let attempt = 0;
    while (true) {
      const { data: existing } = await admin
        .from("brands")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (!existing) break;
      attempt++;
      slug = `${slugify(tempName)}-${attempt}`;
    }

    const { data: brand, error: brandError } = await admin
      .from("brands")
      .insert({
        name: tempName,
        slug,
        website_url: websiteUrl.startsWith("http")
          ? websiteUrl
          : `https://${websiteUrl}`,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (brandError || !brand) {
      return NextResponse.json(
        { error: brandError?.message ?? "Failed to create brand" },
        { status: 500 }
      );
    }

    createdBrandId = brand.id;

    await admin.from("brand_members").insert({
      brand_id: brand.id,
      user_id: user.id,
      role: "owner",
      status: "active",
      joined_at: new Date().toISOString(),
    });

    await Promise.all([
      admin.from("brand_settings").insert({ brand_id: brand.id }),
      admin
        .from("brand_profiles")
        .insert({ brand_id: brand.id, created_by: user.id }),
      admin
        .from("brand_visual_identity")
        .insert({ brand_id: brand.id, created_by: user.id }),
    ]);

    const isProduction = process.env.NODE_ENV === "production";
    const cookieStore = await cookies();
    cookieStore.set(ACTIVE_BRAND_COOKIE, brand.id, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
    });

    const { output } = await importBrand(supabase, {
      websiteUrl,
      brandId: brand.id,
      userId: user.id,
    });

    await admin
      .from("brands")
      .update({ name: output.name })
      .eq("id", brand.id);

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
      .eq("brand_id", brand.id);

    await admin
      .from("brand_visual_identity")
      .update({
        primary_color: output.primary_color,
        secondary_color: output.secondary_color,
        accent_color: output.accent_color,
        style_tags: output.style_tags,
        source: "website_import",
      })
      .eq("brand_id", brand.id);

    trackUsage({
      brandId: brand.id,
      eventType: "website_import",
      userId: user.id,
    }).catch(() => {});

    return NextResponse.json({
      brandId: brand.id,
      brand: {
        name: output.name,
        description: output.description,
        category: output.category,
        positioning: output.positioning,
        value_proposition: output.value_proposition,
        tone_tags: output.tone_tags,
        personality_tags: output.personality_tags,
        primary_color: output.primary_color,
        secondary_color: output.secondary_color,
        accent_color: output.accent_color,
        style_tags: output.style_tags,
      },
      products: output.products,
    });
  } catch (error) {
    console.error("Brand import failed:", error);

    if (createdBrandId) {
      await admin.from("brand_visual_identity").delete().eq("brand_id", createdBrandId);
      await admin.from("brand_profiles").delete().eq("brand_id", createdBrandId);
      await admin.from("brand_settings").delete().eq("brand_id", createdBrandId);
      await admin.from("brand_members").delete().eq("brand_id", createdBrandId);
      await admin.from("brands").delete().eq("id", createdBrandId);
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Brand import failed",
      },
      { status: 500 }
    );
  }
}
