import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/db/supabase-server";
import { verifyBrandMembership } from "@/lib/auth/verify-membership";

const BUCKET = "template-thumbnails";

/**
 * Deletes a brand-uploaded template. System templates (`is_system = true`,
 * `brand_id IS NULL`) are intentionally not deletable through this route —
 * they ship with the app and are managed via migrations.
 *
 * Threads referencing the deleted template have `template_id` set to NULL
 * by the FK constraint (`on delete set null`), so historical threads stay
 * intact but lose their template anchor.
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

  const { data: template, error: fetchErr } = await supabase
    .from("templates")
    .select("id, brand_id, is_system, thumbnail_url")
    .eq("id", templateId)
    .eq("brand_id", brandId)
    .maybeSingle();

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }
  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }
  if (template.is_system) {
    return NextResponse.json(
      { error: "System templates cannot be deleted" },
      { status: 403 }
    );
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
