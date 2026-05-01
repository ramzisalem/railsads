import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/db/supabase-server";
import { verifyBrandMembership } from "@/lib/auth/verify-membership";

const BUCKET = "template-thumbnails";

type TemplateRow = {
  id: string;
  brand_id: string | null;
  is_system: boolean;
  thumbnail_url: string | null;
};

/**
 * PATCH `/api/studio/templates/[templateId]`: update this template's
 * per-brand placement — either move it into a folder (or back to
 * "Unsorted" with `folder_id: null`).
 *
 * Works for both system and brand-owned templates: the placement lives
 * on `brand_template_overrides` so system rows (brand_id IS NULL on the
 * templates table) can still be folder-sorted per brand without
 * mutating the shared catalog.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { templateId } = await params;
  if (!templateId) {
    return NextResponse.json({ error: "Missing templateId" }, { status: 400 });
  }

  let body: { brandId?: string; folder_id?: string | null } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const brandId = String(body.brandId ?? "").trim();
  if (!brandId) {
    return NextResponse.json({ error: "Missing brandId" }, { status: 400 });
  }
  const folderId =
    body.folder_id === undefined || body.folder_id === null
      ? null
      : String(body.folder_id).trim() || null;

  const isMember = await verifyBrandMembership(supabase, user.id, brandId);
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const template = await loadTemplateForBrand(supabase, templateId, brandId);
  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  if (folderId) {
    const { data: folder } = await supabase
      .from("template_folders")
      .select("id")
      .eq("id", folderId)
      .eq("brand_id", brandId)
      .maybeSingle();
    if (!folder) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }
  }

  // Upsert on (brand_id, template_id) — the composite PK. We preserve any
  // existing `hidden` flag by only writing the `folder_id` column.
  const { error: upsertErr } = await supabase
    .from("brand_template_overrides")
    .upsert(
      {
        brand_id: brandId,
        template_id: templateId,
        folder_id: folderId,
      },
      { onConflict: "brand_id,template_id" }
    );

  if (upsertErr) {
    return NextResponse.json({ error: upsertErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

/**
 * DELETE `/api/studio/templates/[templateId]`:
 *
 * - Brand-uploaded template → hard-delete the row + storage object. The
 *   `on delete cascade` on `brand_template_overrides` sweeps any
 *   per-brand placement along with it.
 * - System template → soft-hide it for this brand by upserting
 *   `brand_template_overrides` with `hidden = true`. The shared catalog
 *   is unaffected, so other brands keep seeing it.
 *
 * Threads referencing the deleted template have `template_id` set to
 * NULL by the FK constraint (`on delete set null`), so historical
 * threads stay intact but lose their template anchor.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { templateId } = await params;
  if (!templateId) {
    return NextResponse.json({ error: "Missing templateId" }, { status: 400 });
  }

  const brandId = request.nextUrl.searchParams.get("brandId")?.trim();
  if (!brandId) {
    return NextResponse.json({ error: "Missing brandId" }, { status: 400 });
  }

  const isMember = await verifyBrandMembership(supabase, user.id, brandId);
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const template = await loadTemplateForBrand(supabase, templateId, brandId);
  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  if (template.is_system) {
    const { error: hideErr } = await supabase
      .from("brand_template_overrides")
      .upsert(
        {
          brand_id: brandId,
          template_id: templateId,
          hidden: true,
          folder_id: null,
        },
        { onConflict: "brand_id,template_id" }
      );

    if (hideErr) {
      return NextResponse.json({ error: hideErr.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, hidden: true });
  }

  const { error: deleteErr } = await supabase
    .from("templates")
    .delete()
    .eq("id", templateId)
    .eq("brand_id", brandId);

  if (deleteErr) {
    return NextResponse.json({ error: deleteErr.message }, { status: 500 });
  }

  // Best-effort cleanup of the underlying storage object. We only attempt
  // it for URLs that match the bucket's public path — anything else is a
  // legacy/imported URL we should leave alone.
  if (template.thumbnail_url) {
    const storagePath = extractTemplateStoragePath(template.thumbnail_url);
    if (storagePath) {
      const { error: storageErr } = await supabase.storage
        .from(BUCKET)
        .remove([storagePath]);
      if (storageErr) {
        console.error(
          "template-thumbnail cleanup failed:",
          storageErr.message
        );
      }
    }
  }

  return NextResponse.json({ success: true });
}

async function loadTemplateForBrand(
  supabase: Awaited<ReturnType<typeof createClient>>,
  templateId: string,
  brandId: string
): Promise<TemplateRow | null> {
  const { data } = await supabase
    .from("templates")
    .select("id, brand_id, is_system, thumbnail_url")
    .eq("id", templateId)
    .or(`brand_id.eq.${brandId},brand_id.is.null`)
    .eq("is_active", true)
    .maybeSingle();
  return (data as TemplateRow | null) ?? null;
}

function extractTemplateStoragePath(url: string): string | null {
  try {
    const u = new URL(url);
    const prefix = `/storage/v1/object/public/${BUCKET}/`;
    if (!u.pathname.startsWith(prefix)) return null;
    return u.pathname.slice(prefix.length);
  } catch {
    return null;
  }
}
