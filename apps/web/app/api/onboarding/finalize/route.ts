import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { createClient } from "@/lib/db/supabase-server";
import { createAdminClient } from "@/lib/db/supabase-admin";
import { parseBody } from "@/lib/validation/schemas";
import { ACTIVE_BRAND_COOKIE } from "@/lib/auth/get-current-brand";
import { safeTrackUsage } from "@/lib/billing/gate";
import {
  paletteForDb,
  paletteFromLegacyColors,
  syncLegacyColorsFromPalette,
} from "@/lib/brand/color-palette";
import { storeProductHeroFromUrl } from "@/lib/onboarding/product-hero-image";
import { parseImportPrice } from "@/lib/onboarding/parse-import-price";

/**
 * Finalizes onboarding: creates the brand row and ALL its children
 * (members, settings, profile, visual identity, products, ICPs, competitors)
 * in one go. Sets the active brand cookie and tracks the AI usage events
 * (`website_import` once, `icp_generation` once per product that produced ICPs).
 *
 * Up until this endpoint is called, no rows have been written to the DB for
 * this onboarding session — that's the whole point of deferring creation
 * until the user clicks "Create" on the final step.
 */

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

const paletteRowSchema = z.object({
  segment: z.string().min(1).max(64),
  hex: z.string().min(4).max(32),
});

const brandPayloadSchema = z.object({
  name: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  category: z.string().max(200).optional(),
  positioning: z.string().max(5000).optional(),
  value_proposition: z.string().max(5000).optional(),
  tone_tags: z.array(z.string().max(50)).max(20).optional(),
  personality_tags: z.array(z.string().max(50)).max(20).optional(),
  color_palette: z.array(paletteRowSchema).max(16).optional(),
  primary_color: z.string().max(20).nullable().optional(),
  secondary_color: z.string().max(20).nullable().optional(),
  accent_color: z.string().max(20).nullable().optional(),
  style_tags: z.array(z.string().max(50)).max(20).optional(),
});

const icpPayloadSchema = z.object({
  title: z.string().min(1).max(500),
  summary: z.string().max(5000).optional(),
  pains: z.array(z.string().max(1000)).max(20).optional(),
  desires: z.array(z.string().max(1000)).max(20).optional(),
  objections: z.array(z.string().max(1000)).max(20).optional(),
  triggers: z.array(z.string().max(1000)).max(20).optional(),
});

const productPayloadSchema = z.object({
  name: z.string().min(1).max(500),
  short_description: z.string().max(2000).optional(),
  description: z.string().max(10_000).nullable().optional(),
  price_text: z.string().max(200).nullable().optional(),
  price_currency: z.string().max(3).nullable().optional(),
  product_url: z.string().max(2048).nullable().optional(),
  image_url: z.string().max(2048).nullable().optional(),
  key_features: z.array(z.string().max(500)).max(16).optional(),
  product_category: z.string().max(200).nullable().optional(),
  icps: z.array(icpPayloadSchema).max(10).optional(),
});

const competitorPayloadSchema = z.object({
  name: z.string().min(1).max(500),
  website_url: z.string().max(2048).nullable().optional(),
});

const finalizeSchema = z.object({
  websiteUrl: z.string().min(4).max(2048),
  brand: brandPayloadSchema,
  products: z.array(productPayloadSchema).max(50),
  competitors: z.array(competitorPayloadSchema).max(50).optional(),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: body, error: validationError } = await parseBody(
    request,
    finalizeSchema
  );
  if (validationError) return validationError;

  const { websiteUrl, brand: brandInput, products, competitors } = body;

  const admin = createAdminClient();

  const normalizedWebsiteUrl = websiteUrl.startsWith("http")
    ? websiteUrl
    : `https://${websiteUrl}`;

  // Derive site origin for resolving relative product URLs / images.
  let siteOrigin: string | null = null;
  try {
    siteOrigin = new URL(normalizedWebsiteUrl).origin;
  } catch {
    siteOrigin = null;
  }

  let createdBrandId: string | null = null;

  try {
    // ----------------------------------------------------------------------
    // 1) Brand row + slug
    // ----------------------------------------------------------------------
    let slug = slugify(brandInput.name);
    let attempt = 0;
    while (true) {
      const { data: existing } = await admin
        .from("brands")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (!existing) break;
      attempt++;
      slug = `${slugify(brandInput.name)}-${attempt}`;
    }

    const { data: brand, error: brandError } = await admin
      .from("brands")
      .insert({
        name: brandInput.name,
        slug,
        website_url: normalizedWebsiteUrl,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (brandError || !brand) {
      throw new Error(brandError?.message ?? "Failed to create brand");
    }

    createdBrandId = brand.id;

    // ----------------------------------------------------------------------
    // 2) Membership + settings + profile + visual identity
    // ----------------------------------------------------------------------
    await admin.from("brand_members").insert({
      brand_id: brand.id,
      user_id: user.id,
      role: "owner",
      status: "active",
      joined_at: new Date().toISOString(),
    });

    const palette = brandInput.color_palette?.length
      ? paletteForDb(brandInput.color_palette)
      : paletteFromLegacyColors({
          primary_color: brandInput.primary_color ?? null,
          secondary_color: brandInput.secondary_color ?? null,
          accent_color: brandInput.accent_color ?? null,
        });
    const legacyColors = syncLegacyColorsFromPalette(palette);

    await Promise.all([
      admin.from("brand_settings").insert({ brand_id: brand.id }),
      admin.from("brand_profiles").insert({
        brand_id: brand.id,
        description: brandInput.description ?? null,
        category: brandInput.category ?? null,
        positioning: brandInput.positioning ?? null,
        value_proposition: brandInput.value_proposition ?? null,
        tone_tags: brandInput.tone_tags ?? [],
        personality_tags: brandInput.personality_tags ?? [],
        source: "website_import",
        created_by: user.id,
      }),
      admin.from("brand_visual_identity").insert({
        brand_id: brand.id,
        color_palette: palette,
        primary_color: legacyColors.primary_color,
        secondary_color: legacyColors.secondary_color,
        accent_color: legacyColors.accent_color,
        style_tags: brandInput.style_tags ?? [],
        source: "website_import",
        created_by: user.id,
      }),
    ]);

    // ----------------------------------------------------------------------
    // 3) Products + per-product ICPs (sequential to keep ordering predictable)
    // ----------------------------------------------------------------------
    let icpRunCount = 0;
    let firstProductId: string | null = null;

    for (const product of products) {
      const { price_amount, price_currency } = parseImportPrice(
        product.price_text ?? null,
        product.price_currency ?? null
      );

      // Resolve relative product URLs against the site origin.
      let productUrl = product.product_url?.trim() || null;
      if (
        productUrl &&
        siteOrigin &&
        !/^https?:\/\//i.test(productUrl)
      ) {
        try {
          const base = siteOrigin.endsWith("/")
            ? siteOrigin
            : `${siteOrigin}/`;
          productUrl = new URL(productUrl, base).href;
        } catch {
          /* keep as-is */
        }
      }

      const benefits = (product.key_features ?? [])
        .map((s) => s.trim())
        .filter(Boolean);
      const attributes: Record<string, unknown> = {};
      if (benefits.length > 0) attributes.benefits = benefits;
      if (product.price_text?.trim()) {
        attributes.import_price_text = product.price_text.trim();
      }
      if (product.product_category?.trim()) {
        attributes.import_category = product.product_category.trim();
      }

      const { data: insertedProduct, error: productError } = await admin
        .from("products")
        .insert({
          brand_id: brand.id,
          name: product.name.trim(),
          short_description: product.short_description?.trim() || null,
          description: product.description?.trim() || null,
          price_amount,
          price_currency,
          product_url: productUrl,
          attributes,
          source: "website_import",
          created_by: user.id,
        })
        .select("id")
        .single();

      if (productError || !insertedProduct) {
        console.error("Failed to insert product:", productError);
        continue;
      }

      if (!firstProductId) firstProductId = insertedProduct.id;

      // Hero image — best-effort, never blocks the flow.
      if (product.image_url?.trim()) {
        try {
          await storeProductHeroFromUrl(admin, {
            brandId: brand.id,
            productId: insertedProduct.id,
            userId: user.id,
            imageUrl: product.image_url.trim(),
            siteOrigin,
            productUrl,
          });
        } catch (e) {
          console.error("Product hero image import:", e);
        }
      }

      // ICPs for this product
      if (product.icps && product.icps.length > 0) {
        const icpRows = product.icps.map((icp) => ({
          brand_id: brand.id,
          product_id: insertedProduct.id,
          title: icp.title,
          summary: icp.summary ?? null,
          pains: icp.pains ?? [],
          desires: icp.desires ?? [],
          objections: icp.objections ?? [],
          triggers: icp.triggers ?? [],
          source: "ai_generated" as const,
          created_by: user.id,
        }));
        const { error: icpError } = await admin.from("icps").insert(icpRows);
        if (icpError) {
          console.error("Failed to insert ICPs:", icpError);
        } else {
          icpRunCount++;
        }
      }
    }

    // ----------------------------------------------------------------------
    // 4) Competitors (optional)
    // ----------------------------------------------------------------------
    if (competitors && competitors.length > 0) {
      const valid = competitors.filter((c) => c.name.trim());
      if (valid.length > 0) {
        await admin.from("competitors").insert(
          valid.map((c) => ({
            brand_id: brand.id,
            name: c.name.trim(),
            website_url: c.website_url?.trim() || null,
            created_by: user.id,
          }))
        );
      }
    }

    // ----------------------------------------------------------------------
    // 5) Usage tracking — one website_import + N icp_generation
    // ----------------------------------------------------------------------
    void safeTrackUsage({
      brandId: brand.id,
      eventType: "website_import",
      userId: user.id,
    });

    for (let i = 0; i < icpRunCount; i++) {
      void safeTrackUsage({
        brandId: brand.id,
        eventType: "icp_generation",
        userId: user.id,
      });
    }

    // ----------------------------------------------------------------------
    // 6) Active brand cookie + return ids
    // ----------------------------------------------------------------------
    const isProduction = process.env.NODE_ENV === "production";
    const cookieStore = await cookies();
    cookieStore.set(ACTIVE_BRAND_COOKIE, brand.id, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
    });

    return NextResponse.json({
      brandId: brand.id,
      firstProductId,
    });
  } catch (error) {
    console.error("Onboarding finalize failed:", error);

    // Best-effort rollback — if the brand row was created, tear it (and its
    // cascading children) back down so we don't leave orphaned drafts behind.
    if (createdBrandId) {
      try {
        await admin.from("icps").delete().eq("brand_id", createdBrandId);
        await admin.from("competitors").delete().eq("brand_id", createdBrandId);
        await admin.from("products").delete().eq("brand_id", createdBrandId);
        await admin
          .from("brand_visual_identity")
          .delete()
          .eq("brand_id", createdBrandId);
        await admin
          .from("brand_profiles")
          .delete()
          .eq("brand_id", createdBrandId);
        await admin
          .from("brand_settings")
          .delete()
          .eq("brand_id", createdBrandId);
        await admin
          .from("brand_members")
          .delete()
          .eq("brand_id", createdBrandId);
        await admin.from("brands").delete().eq("id", createdBrandId);
      } catch (cleanupErr) {
        console.error("Finalize rollback failed:", cleanupErr);
      }
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Onboarding finalize failed",
      },
      { status: 500 }
    );
  }
}
