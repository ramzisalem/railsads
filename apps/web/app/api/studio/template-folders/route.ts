import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/db/supabase-server";
import { verifyBrandMembership } from "@/lib/auth/verify-membership";

const MAX_NAME_LENGTH = 60;

/**
 * Create a brand-scoped template folder. Folders are just named buckets
 * — brand_template_overrides rows reference them so templates (system or
 * brand-owned) can be grouped under the same folder_id.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { brandId?: string; name?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const brandId = String(body.brandId ?? "").trim();
  const name = String(body.name ?? "").trim();

  if (!brandId || !name) {
    return NextResponse.json(
      { error: "brandId and name are required" },
      { status: 400 }
    );
  }
  if (name.length > MAX_NAME_LENGTH) {
    return NextResponse.json(
      { error: `Folder name must be ${MAX_NAME_LENGTH} characters or fewer` },
      { status: 400 }
    );
  }

  const isMember = await verifyBrandMembership(supabase, user.id, brandId);
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Append-to-end sort position so freshly-created folders land after
  // existing ones (simple, predictable ordering without reshuffling).
  const { data: maxRow } = await supabase
    .from("template_folders")
    .select("sort_order")
    .eq("brand_id", brandId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextSort = (maxRow?.sort_order ?? -1) + 1;

  const { data: inserted, error: insertErr } = await supabase
    .from("template_folders")
    .insert({ brand_id: brandId, name, sort_order: nextSort })
    .select("id, name, sort_order")
    .single();

  if (insertErr || !inserted) {
    const message =
      insertErr?.code === "23505"
        ? "A folder with that name already exists"
        : insertErr?.message || "Failed to create folder";
    return NextResponse.json(
      { error: message },
      { status: insertErr?.code === "23505" ? 409 : 500 }
    );
  }

  return NextResponse.json({ folder: inserted });
}
