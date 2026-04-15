import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/db/supabase-server";
import { createAdminClient } from "@/lib/db/supabase-admin";
import { parseBody, saveCompetitorSchema } from "@/lib/validation/schemas";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: body, error: validationError } = await parseBody(request, saveCompetitorSchema);
  if (validationError) return validationError;

  const { brandId, name, websiteUrl } = body;

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

  const { data: competitor, error } = await admin
    .from("competitors")
    .insert({
      brand_id: brandId,
      name: name.trim(),
      website_url: websiteUrl?.trim() || null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !competitor) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to save competitor" },
      { status: 500 }
    );
  }

  return NextResponse.json({ competitorId: competitor.id });
}
