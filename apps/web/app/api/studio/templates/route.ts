import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/db/supabase-server";
import { verifyBrandMembership } from "@/lib/auth/verify-membership";

const BUCKET = "template-thumbnails";
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

function extFor(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  return "jpg";
}

/**
 * Brand-uploaded template thumbnails. Mirrors the chat-attachment upload
 * shape (multipart form, brandId in the body, file under `file`) and adds
 * the persisted DB row. The new row has `is_system = false`, `brand_id =
 * brandId`, and a slugified key uniqued against `(brand_id, key)`.
 *
 * The thumbnail itself is uploaded to the public `template-thumbnails`
 * bucket so the picker can render it directly via its public URL — and so
 * the AI image pipeline can re-fetch it as a layout reference.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart form data" },
      { status: 400 }
    );
  }

  const brandId = String(formData.get("brandId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const folderId = String(formData.get("folderId") ?? "").trim() || null;
  const file = formData.get("file");

  if (!brandId || !name || !(file instanceof File)) {
    return NextResponse.json(
      { error: "brandId, name, and file are required" },
      { status: 400 }
    );
  }
  if (!folderId) {
    return NextResponse.json(
      { error: "folderId is required — every template must live in a folder" },
      { status: 400 }
    );
  }

  if (name.length > 80) {
    return NextResponse.json(
      { error: "Template name must be 80 characters or fewer" },
      { status: 400 }
    );
  }

  if (description.length > 500) {
    return NextResponse.json(
      { error: "Description must be 500 characters or fewer" },
      { status: 400 }
    );
  }

  const isMember = await verifyBrandMembership(supabase, user.id, brandId);
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Verify the folder exists and is brand-scoped before spending any
  // effort on the upload — bails early on stale UIs pointing at a
  // deleted folder.
  const { data: folderRow } = await supabase
    .from("template_folders")
    .select("id")
    .eq("id", folderId)
    .eq("brand_id", brandId)
    .maybeSingle();
  if (!folderRow) {
    return NextResponse.json(
      { error: "Folder not found" },
      { status: 400 }
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Image must be 10MB or smaller" },
      { status: 400 }
    );
  }

  const mime = file.type || "application/octet-stream";
  if (!ALLOWED_MIME.has(mime)) {
    return NextResponse.json(
      { error: "Only PNG, JPEG, WebP, or GIF images are allowed" },
      { status: 400 }
    );
  }

  // Resolve a unique key inside this brand. Brand-scoped templates share
  // the same `(brand_id, key)` unique constraint as system ones, so we
  // suffix collisions with `-2`, `-3`, etc.
  const baseKey = slugify(name) || "template";
  let key = baseKey;
  for (let attempt = 1; attempt < 20; attempt++) {
    const { data: existing } = await supabase
      .from("templates")
      .select("id")
      .eq("brand_id", brandId)
      .eq("key", key)
      .maybeSingle();
    if (!existing) break;
    key = `${baseKey}-${attempt + 1}`;
  }

  const ext = extFor(mime);
  const storagePath = `${brandId}/${randomUUID()}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buf, { contentType: mime, upsert: false });

  if (upErr) {
    console.error("template-thumbnail upload:", upErr);
    return NextResponse.json(
      { error: upErr.message || "Upload failed" },
      { status: 500 }
    );
  }

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);

  // Custom templates ship without `structure.layout`/`sections`/`guidelines`
  // because the user only gives us a thumbnail — gpt-image-1 will read the
  // image itself as the layout reference (see image-prompt-suffix.ts) and
  // we surface a default note so the prompt builder still has a guideline
  // to fall back on.
  const structure = {
    layout: "Use the attached template thumbnail as the visual reference.",
    sections: [],
    guidelines:
      "Match the layout, panel arrangement, and visual rhythm of the template thumbnail. Substitute our product, copy, and brand palette for any placeholder content.",
  };

  const { data: inserted, error: insertErr } = await supabase
    .from("templates")
    .insert({
      brand_id: brandId,
      key,
      name,
      description: description || null,
      category: "custom",
      structure,
      is_system: false,
      is_active: true,
      thumbnail_url: pub.publicUrl,
    })
    .select("id, key, name, description, category, thumbnail_url, is_system")
    .single();

  if (insertErr || !inserted) {
    // Roll back the orphaned upload — leaving it in storage would slowly
    // bloat the bucket without ever being referenced.
    await supabase.storage
      .from(BUCKET)
      .remove([storagePath])
      .then(({ error }) => {
        if (error) {
          console.error(
            "template-thumbnail rollback failed:",
            error.message
          );
        }
      });
    return NextResponse.json(
      { error: insertErr?.message || "Failed to save template" },
      { status: 500 }
    );
  }

  // Attach the template to its chosen folder. We do this as a separate
  // override row (instead of a column on `templates`) so the same model
  // covers moving the template later on without any schema change.
  const { error: overrideErr } = await supabase
    .from("brand_template_overrides")
    .upsert(
      {
        brand_id: brandId,
        template_id: inserted.id,
        folder_id: folderId,
        hidden: false,
      },
      { onConflict: "brand_id,template_id" }
    );
  if (overrideErr) {
    console.error(
      "template folder placement failed after upload:",
      overrideErr
    );
    // The template itself is saved and usable — failing the whole request
    // for a placement glitch would be worse UX than shipping it as-is. The
    // picker will surface it in its category's auto-seeded folder since
    // we always ensure seeding ran.
  }

  return NextResponse.json({
    template: { ...inserted, folder_id: folderId },
  });
}
