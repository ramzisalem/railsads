import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/db/supabase-server";
import { verifyBrandMembership } from "@/lib/auth/verify-membership";
import { randomUUID } from "crypto";

const BUCKET = "chat-attachments";
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

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
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const brandId = String(formData.get("brandId") ?? "").trim();
  const threadId = String(formData.get("threadId") ?? "").trim();
  const file = formData.get("file");

  if (!brandId || !threadId || !(file instanceof File)) {
    return NextResponse.json(
      { error: "brandId, threadId, and file are required" },
      { status: 400 }
    );
  }

  const isMember = await verifyBrandMembership(supabase, user.id, brandId);
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: thread, error: threadErr } = await supabase
    .from("threads")
    .select("id")
    .eq("id", threadId)
    .eq("brand_id", brandId)
    .is("archived_at", null)
    .maybeSingle();

  if (threadErr || !thread) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image must be 10MB or smaller" }, { status: 400 });
  }

  const mime = file.type || "application/octet-stream";
  if (!ALLOWED.has(mime)) {
    return NextResponse.json(
      { error: "Only PNG, JPEG, WebP, or GIF images are allowed" },
      { status: 400 }
    );
  }

  const ext =
    mime === "image/png"
      ? "png"
      : mime === "image/webp"
        ? "webp"
        : mime === "image/gif"
          ? "gif"
          : "jpg";

  const path = `${brandId}/${threadId}/${randomUUID()}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, buf, { contentType: mime, upsert: false });

  if (upErr) {
    console.error("chat-attachment upload:", upErr);
    return NextResponse.json(
      { error: upErr.message || "Upload failed" },
      { status: 500 }
    );
  }

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);

  return NextResponse.json({ url: pub.publicUrl, path });
}
