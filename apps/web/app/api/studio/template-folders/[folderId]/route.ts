import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/db/supabase-server";
import { verifyBrandMembership } from "@/lib/auth/verify-membership";

const MAX_NAME_LENGTH = 60;
const TEMPLATE_BUCKET = "template-thumbnails";

/** Extract the storage path out of a public template-thumbnails URL so we
 *  can remove the underlying object when a brand template is destroyed
 *  alongside its folder. Returns null for legacy / external URLs. */
function extractTemplateStoragePath(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const prefix = `/storage/v1/object/public/${TEMPLATE_BUCKET}/`;
    if (!u.pathname.startsWith(prefix)) return null;
    return u.pathname.slice(prefix.length);
  } catch {
    return null;
  }
}

/**
 * Rename a brand-scoped template folder.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ folderId: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { folderId } = await params;

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

  const { data: updated, error: updateErr } = await supabase
    .from("template_folders")
    .update({ name })
    .eq("id", folderId)
    .eq("brand_id", brandId)
    .select("id, name, sort_order")
    .maybeSingle();

  if (updateErr) {
    const message =
      updateErr.code === "23505"
        ? "A folder with that name already exists"
        : updateErr.message || "Failed to rename folder";
    return NextResponse.json(
      { error: message },
      { status: updateErr.code === "23505" ? 409 : 500 }
    );
  }
  if (!updated) {
    return NextResponse.json({ error: "Folder not found" }, { status: 404 });
  }

  return NextResponse.json({ folder: updated });
}

/**
 * Delete a brand-scoped template folder.
 *
 * Two modes driven by the optional `?moveTo=<folderId>` query param:
 *
 *   1. `moveTo` present → reassign every template in this folder to the
 *      target folder, then delete the (now-empty) folder row. Non-
 *      destructive; used by the "Move templates to…" action in the
 *      folder actions menu. Target must belong to the same brand and
 *      must not be the folder being deleted.
 *
 *   2. `moveTo` absent → cascade delete. Folder AND every template
 *      inside it are destroyed. Per template type:
 *        - Brand-uploaded templates → hard-delete the `templates` row
 *          and best-effort cleanup of the thumbnail in storage. Their
 *          override rows disappear via `on delete cascade`.
 *        - System templates → upsert the override to `hidden = true`
 *          with folder cleared. The shared catalog is untouched; the
 *          templates just stop showing up for this brand.
 *
 * Folder removal is always the last step so a partial failure leaves the
 * folder in place for a retry.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ folderId: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { folderId } = await params;
  const brandId = request.nextUrl.searchParams.get("brandId")?.trim();
  if (!brandId) {
    return NextResponse.json({ error: "Missing brandId" }, { status: 400 });
  }
  const moveTo = request.nextUrl.searchParams.get("moveTo")?.trim() || null;

  const isMember = await verifyBrandMembership(supabase, user.id, brandId);
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Confirm the folder exists and is ours. Doing this up-front gives us
  // a stable 404 and lets the rest of the route assume the folder is valid.
  const { data: folder } = await supabase
    .from("template_folders")
    .select("id")
    .eq("id", folderId)
    .eq("brand_id", brandId)
    .maybeSingle();
  if (!folder) {
    return NextResponse.json({ error: "Folder not found" }, { status: 404 });
  }

  // ----- Mode 1: reassign then delete ---------------------------------
  if (moveTo) {
    if (moveTo === folderId) {
      return NextResponse.json(
        { error: "Can't move templates into the folder you're deleting" },
        { status: 400 }
      );
    }
    const { data: target } = await supabase
      .from("template_folders")
      .select("id")
      .eq("id", moveTo)
      .eq("brand_id", brandId)
      .maybeSingle();
    if (!target) {
      return NextResponse.json(
        { error: "Destination folder not found" },
        { status: 400 }
      );
    }

    const { error: moveErr } = await supabase
      .from("brand_template_overrides")
      .update({ folder_id: moveTo })
      .eq("brand_id", brandId)
      .eq("folder_id", folderId);
    if (moveErr) {
      return NextResponse.json({ error: moveErr.message }, { status: 500 });
    }

    const { error: deleteErr, count } = await supabase
      .from("template_folders")
      .delete({ count: "exact" })
      .eq("id", folderId)
      .eq("brand_id", brandId);
    if (deleteErr) {
      return NextResponse.json({ error: deleteErr.message }, { status: 500 });
    }
    if (!count) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, movedTo: moveTo });
  }

  // ----- Mode 2: cascade delete ---------------------------------------
  // Pull every template attached to this folder along with the bits we
  // need to decide between hard-delete vs hide and to clean up storage.
  const { data: contents, error: contentsErr } = await supabase
    .from("brand_template_overrides")
    .select(
      `template_id,
       templates!inner ( id, brand_id, is_system, thumbnail_url )`
    )
    .eq("brand_id", brandId)
    .eq("folder_id", folderId);

  if (contentsErr) {
    return NextResponse.json({ error: contentsErr.message }, { status: 500 });
  }

  type ContentRow = {
    template_id: string;
    templates:
      | {
          id: string;
          brand_id: string | null;
          is_system: boolean;
          thumbnail_url: string | null;
        }
      | Array<{
          id: string;
          brand_id: string | null;
          is_system: boolean;
          thumbnail_url: string | null;
        }>
      | null;
  };

  const systemTemplateIds: string[] = [];
  const brandTemplates: {
    id: string;
    thumbnail_url: string | null;
  }[] = [];

  for (const row of (contents ?? []) as ContentRow[]) {
    const t = Array.isArray(row.templates) ? row.templates[0] : row.templates;
    if (!t) continue;
    if (t.is_system) {
      systemTemplateIds.push(t.id);
    } else if (t.brand_id === brandId) {
      brandTemplates.push({ id: t.id, thumbnail_url: t.thumbnail_url });
    }
  }

  // Hide system templates for this brand. Upsert preserves the composite
  // PK and sets both flags so the entry is unambiguously "not in picker".
  if (systemTemplateIds.length > 0) {
    const hideRows = systemTemplateIds.map((templateId) => ({
      brand_id: brandId,
      template_id: templateId,
      folder_id: null,
      hidden: true,
    }));
    const { error: hideErr } = await supabase
      .from("brand_template_overrides")
      .upsert(hideRows, { onConflict: "brand_id,template_id" });
    if (hideErr) {
      return NextResponse.json({ error: hideErr.message }, { status: 500 });
    }
  }

  // Hard-delete brand-uploaded templates. The FK cascade on
  // brand_template_overrides clears their placement rows automatically.
  if (brandTemplates.length > 0) {
    const ids = brandTemplates.map((t) => t.id);
    const { error: delTemplatesErr } = await supabase
      .from("templates")
      .delete()
      .in("id", ids)
      .eq("brand_id", brandId);
    if (delTemplatesErr) {
      return NextResponse.json(
        { error: delTemplatesErr.message },
        { status: 500 }
      );
    }

    // Best-effort storage cleanup. A failure here leaves orphaned
    // bytes in the bucket but the DB state is consistent, which is
    // what matters for the picker.
    const storagePaths = brandTemplates
      .map((t) => extractTemplateStoragePath(t.thumbnail_url))
      .filter((p): p is string => Boolean(p));
    if (storagePaths.length > 0) {
      const { error: storageErr } = await supabase.storage
        .from(TEMPLATE_BUCKET)
        .remove(storagePaths);
      if (storageErr) {
        console.error(
          "template-thumbnail cascade cleanup failed:",
          storageErr.message
        );
      }
    }
  }

  const { error: deleteErr, count } = await supabase
    .from("template_folders")
    .delete({ count: "exact" })
    .eq("id", folderId)
    .eq("brand_id", brandId);

  if (deleteErr) {
    return NextResponse.json({ error: deleteErr.message }, { status: 500 });
  }
  if (!count) {
    return NextResponse.json({ error: "Folder not found" }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    deletedTemplateCount: brandTemplates.length,
    hiddenTemplateCount: systemTemplateIds.length,
  });
}
