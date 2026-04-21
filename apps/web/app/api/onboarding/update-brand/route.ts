import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/db/supabase-server";
import { createAdminClient } from "@/lib/db/supabase-admin";
import { verifyBrandMembership } from "@/lib/auth/verify-membership";
import { parseBody, updateBrandSchema } from "@/lib/validation/schemas";
import {
  paletteForDb,
  paletteFromLegacyColors,
  syncLegacyColorsFromPalette,
} from "@/lib/brand/color-palette";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: body, error: validationError } = await parseBody(request, updateBrandSchema);
  if (validationError) return validationError;

  const { brandId, brand } = body;

  const isMember = await verifyBrandMembership(supabase, user.id, brandId);
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();

  await admin
    .from("brands")
    .update({ name: brand.name })
    .eq("id", brandId);

  await admin
    .from("brand_profiles")
    .update({
      description: brand.description,
      category: brand.category,
      positioning: brand.positioning,
      value_proposition: brand.value_proposition,
      tone_tags: brand.tone_tags,
      personality_tags: brand.personality_tags,
    })
    .eq("brand_id", brandId);

  const palette = brand.color_palette?.length
    ? paletteForDb(brand.color_palette)
    : paletteFromLegacyColors({
        primary_color: brand.primary_color ?? null,
        secondary_color: brand.secondary_color ?? null,
        accent_color: brand.accent_color ?? null,
      });
  const legacy = syncLegacyColorsFromPalette(palette);

  await admin
    .from("brand_visual_identity")
    .update({
      color_palette: palette,
      primary_color: legacy.primary_color,
      secondary_color: legacy.secondary_color,
      accent_color: legacy.accent_color,
      style_tags: brand.style_tags,
    })
    .eq("brand_id", brandId);

  return NextResponse.json({ success: true });
}
