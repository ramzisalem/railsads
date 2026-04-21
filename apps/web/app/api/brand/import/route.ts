import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/db/supabase-server";
import { importBrand, enrichProductImages } from "@/lib/ai/services";
import { parseBody, brandImportSchema } from "@/lib/validation/schemas";
import {
  paletteForDb,
  paletteFromLegacyColors,
  syncLegacyColorsFromPalette,
} from "@/lib/brand/color-palette";

/**
 * Imports a brand from a website URL.
 *
 * IMPORTANT: This endpoint does NOT persist anything to the database.
 * All extracted data is returned to the client and held in onboarding state
 * until the user clicks "Create" on the final step, which calls
 * `/api/onboarding/finalize` to actually create the brand and its children.
 *
 * Credits are NOT deducted here either — usage is tracked once at finalize.
 */
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
    brandImportSchema
  );
  if (validationError) return validationError;

  const { websiteUrl } = body;

  try {
    const tempName = new URL(
      websiteUrl.startsWith("http") ? websiteUrl : `https://${websiteUrl}`
    ).hostname.replace(/^www\./, "");

    const {
      output: rawOutput,
      homepageHtml,
      jsonLdProducts,
      detectedPalette,
    } = await importBrand(supabase, {
      websiteUrl,
      userId: user.id,
    });

    // Per-product PDP discovery + crawl + vision-based pack-shot selection.
    // Wrapped so any failure inside enrichment never blocks the import path.
    let output = rawOutput;
    try {
      output = await enrichProductImages(rawOutput, websiteUrl, {
        homepageHtml,
        jsonLdProducts,
      });
    } catch (e) {
      console.error("enrichProductImages (import) failed:", e);
    }

    const importPalette = paletteForDb(
      paletteFromLegacyColors({
        primary_color: output.primary_color,
        secondary_color: output.secondary_color,
        accent_color: output.accent_color,
      })
    );
    const importLegacy = syncLegacyColorsFromPalette(importPalette);

    return NextResponse.json({
      brand: {
        name: output.name || tempName,
        description: output.description,
        category: output.category,
        positioning: output.positioning,
        value_proposition: output.value_proposition,
        tone_tags: output.tone_tags,
        personality_tags: output.personality_tags,
        primary_color: importLegacy.primary_color,
        secondary_color: importLegacy.secondary_color,
        accent_color: importLegacy.accent_color,
        color_palette: importPalette,
        /** Full ranked palette from the site's CSS — surfaced to the editor's
         * "+ Add color" suggestion menu so users can pick from real brand
         * colors instead of typing hex codes. */
        detected_palette: detectedPalette,
        style_tags: output.style_tags,
      },
      products: output.products,
      websiteUrl: websiteUrl.startsWith("http")
        ? websiteUrl
        : `https://${websiteUrl}`,
    });
  } catch (error) {
    console.error("Brand import failed:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Brand import failed",
      },
      { status: 500 }
    );
  }
}
