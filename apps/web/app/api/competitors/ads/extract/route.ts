import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/db/supabase-server";
import { verifyBrandMembership } from "@/lib/auth/verify-membership";
import {
  uploadCompetitorAdImageBuffer,
  uploadCompetitorAdImageFromUrl,
} from "@/lib/competitors/asset-upload";
import {
  extractCompetitorAd,
  fetchCompetitorPagePreview,
} from "@/lib/ai/services";

/**
 * Effortless competitor ad capture.
 *
 *   - multipart/form-data: one or many image files → uploaded to
 *     `competitor-ads`, vision-extracted, returned as draft fields. The client
 *     then calls the standard `createCompetitorAd` server action with the
 *     uploaded asset ids attached.
 *   - application/json `{ url }`: fetch the page, pull og:image + clean text,
 *     vision-extract, and (best effort) store the og:image as a competitor ad
 *     asset for the upcoming ad row.
 *
 * In both cases this route ONLY uploads the asset and returns extracted draft
 * fields. The actual `competitor_ads` row is inserted by the existing server
 * action so we keep one source of truth for revalidation + RLS.
 */

const MAX_FILES = 4;
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

interface ExtractedAsset {
  assetId: string;
  storagePath: string;
  publicUrl: string;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("application/json")) {
      return await handleUrlPaste(request, supabase, user.id);
    }
    if (contentType.includes("multipart/form-data")) {
      return await handleImageUpload(request, supabase, user.id);
    }
    return NextResponse.json(
      { error: "Expected multipart/form-data (images) or application/json (url)" },
      { status: 400 }
    );
  } catch (err) {
    console.error("[competitors/ads/extract] failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Extraction failed" },
      { status: 500 }
    );
  }
}

async function handleImageUpload(
  request: NextRequest,
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<NextResponse> {
  const form = await request.formData();
  const brandId = String(form.get("brandId") ?? "").trim();
  const competitorId = String(form.get("competitorId") ?? "").trim();

  if (!brandId || !competitorId) {
    return NextResponse.json(
      { error: "brandId and competitorId are required" },
      { status: 400 }
    );
  }

  const isMember = await verifyBrandMembership(supabase, userId, brandId);
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const files = form
    .getAll("files")
    .filter((f): f is File => f instanceof File)
    .slice(0, MAX_FILES);

  if (files.length === 0) {
    return NextResponse.json(
      { error: "At least one image file is required" },
      { status: 400 }
    );
  }

  const uploaded: ExtractedAsset[] = [];
  for (const file of files) {
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `${file.name}: image must be 10MB or smaller` },
        { status: 400 }
      );
    }
    const mime = file.type || "application/octet-stream";
    if (!ALLOWED_MIME.has(mime)) {
      return NextResponse.json(
        { error: `${file.name}: only PNG, JPEG, WebP, or GIF allowed` },
        { status: 400 }
      );
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const stored = await uploadCompetitorAdImageBuffer(supabase, {
      brandId,
      competitorId,
      userId,
      buffer: buf,
      mime,
      originalName: file.name,
      metadata: { source: "upload", original_filename: file.name },
    });
    uploaded.push(stored);
  }

  const brandName = await fetchBrandName(supabase, brandId);
  const draft = await extractCompetitorAd({
    imageUrls: uploaded.map((u) => u.publicUrl),
    brandName,
  });

  return NextResponse.json({
    assets: uploaded,
    draft,
    source: "upload",
  });
}

async function handleUrlPaste(
  request: NextRequest,
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<NextResponse> {
  const body = (await request.json().catch(() => ({}))) as {
    brandId?: string;
    competitorId?: string;
    url?: string;
  };

  const brandId = (body.brandId ?? "").trim();
  const competitorId = (body.competitorId ?? "").trim();
  const url = (body.url ?? "").trim();

  if (!brandId || !competitorId || !url) {
    return NextResponse.json(
      { error: "brandId, competitorId, and url are required" },
      { status: 400 }
    );
  }
  if (url.length > 2048) {
    return NextResponse.json({ error: "URL is too long" }, { status: 400 });
  }

  const isMember = await verifyBrandMembership(supabase, userId, brandId);
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const preview = await fetchCompetitorPagePreview(url);
  if (!preview) {
    return NextResponse.json(
      { error: "Couldn't load that URL. Try uploading a screenshot instead." },
      { status: 422 }
    );
  }

  const uploaded: ExtractedAsset[] = [];
  if (preview.imageUrl) {
    const stored = await uploadCompetitorAdImageFromUrl(supabase, {
      brandId,
      competitorId,
      userId,
      imageUrl: preview.imageUrl,
      sourceUrl: preview.finalUrl,
    });
    if (stored) uploaded.push(stored);
  }

  const brandName = await fetchBrandName(supabase, brandId);
  const draft = await extractCompetitorAd({
    imageUrls: uploaded.map((u) => u.publicUrl),
    pageText: preview.text,
    sourceUrl: preview.finalUrl,
    brandName,
  });

  return NextResponse.json({
    assets: uploaded,
    draft,
    source: "url",
    sourceUrl: preview.finalUrl,
    landingPageUrl: preview.landingPageUrl,
  });
}

async function fetchBrandName(
  supabase: Awaited<ReturnType<typeof createClient>>,
  brandId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("brands")
    .select("name")
    .eq("id", brandId)
    .maybeSingle();
  return data?.name ?? null;
}
