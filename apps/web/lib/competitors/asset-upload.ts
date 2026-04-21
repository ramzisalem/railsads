import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  assertSafeImageFetchUrl,
  resolveProductImageUrl,
} from "@/lib/onboarding/product-hero-image";

/**
 * Upload helpers for competitor ad screenshots.
 *
 * Files land in the public `competitor-ads` storage bucket (see
 * `supabase/migrations/024_storage_competitor_ads_bucket.sql`) and we record
 * an `assets` row + `competitor_ad_asset_links` row so downstream prompts
 * (multimodal analysis, "Use as reference" in Studio) can resolve them.
 */

export const COMPETITOR_ADS_BUCKET = "competitor-ads";
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

function extFromMime(mime: string | null): string {
  const m = (mime ?? "").toLowerCase();
  if (m.includes("png")) return "png";
  if (m.includes("webp")) return "webp";
  if (m.includes("gif")) return "gif";
  return "jpg";
}

export async function uploadCompetitorAdImageBuffer(
  supabase: SupabaseClient,
  params: {
    brandId: string;
    competitorId: string;
    userId: string;
    buffer: Buffer;
    mime: string;
    originalName?: string;
    /** Optional `assets.metadata` payload — e.g. `{ source: "url", source_url }` */
    metadata?: Record<string, unknown>;
  }
): Promise<{ assetId: string; storagePath: string; publicUrl: string }> {
  if (params.buffer.byteLength === 0) {
    throw new Error("Empty image body");
  }
  if (params.buffer.byteLength > MAX_BYTES) {
    throw new Error("Image must be 10MB or smaller");
  }

  const mime = (params.mime || "").toLowerCase();
  if (!ALLOWED_MIME.has(mime)) {
    throw new Error("Only PNG, JPEG, WebP, or GIF images are allowed");
  }

  const ext = extFromMime(mime);
  const storagePath = `${params.brandId}/${params.competitorId}/${Date.now()}-${randomUUID()}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from(COMPETITOR_ADS_BUCKET)
    .upload(storagePath, params.buffer, {
      contentType: mime,
      upsert: false,
    });
  if (upErr) throw new Error(upErr.message);

  const { data: asset, error: assetErr } = await supabase
    .from("assets")
    .insert({
      brand_id: params.brandId,
      kind: "competitor_ad",
      bucket: COMPETITOR_ADS_BUCKET,
      storage_path: storagePath,
      mime_type: mime,
      file_size_bytes: params.buffer.byteLength,
      metadata: params.metadata ?? {},
      created_by: params.userId,
    })
    .select("id")
    .single();

  if (assetErr || !asset) {
    await supabase.storage.from(COMPETITOR_ADS_BUCKET).remove([storagePath]);
    throw new Error(assetErr?.message ?? "Failed to create asset");
  }

  const { data: pub } = supabase.storage
    .from(COMPETITOR_ADS_BUCKET)
    .getPublicUrl(storagePath);

  return {
    assetId: asset.id,
    storagePath,
    publicUrl: pub.publicUrl,
  };
}

/**
 * Fetch an external URL and store it as a competitor ad asset. Use for the
 * og:image we discover when the user pastes a Meta Ad Library / TikTok URL.
 */
export async function uploadCompetitorAdImageFromUrl(
  supabase: SupabaseClient,
  params: {
    brandId: string;
    competitorId: string;
    userId: string;
    imageUrl: string;
    /** Echoed onto `assets.metadata.source_url` for traceability. */
    sourceUrl?: string | null;
  }
): Promise<{ assetId: string; storagePath: string; publicUrl: string } | null> {
  let resolved: string;
  try {
    resolved = resolveProductImageUrl(params.imageUrl, {
      siteOrigin: null,
      productUrl: params.sourceUrl ?? null,
    });
    assertSafeImageFetchUrl(resolved);
  } catch {
    return null;
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  let res: Response;
  try {
    res = await fetch(resolved, {
      signal: ctrl.signal,
      headers: {
        Accept: "image/*",
        "User-Agent":
          "Mozilla/5.0 (compatible; RailsAds/1.0; +https://railsads.com)",
      },
    });
  } catch {
    clearTimeout(timer);
    return null;
  }
  clearTimeout(timer);

  if (!res.ok) return null;

  const mime = res.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
  if (mime && !mime.startsWith("image/")) return null;
  const normalizedMime = mime || "image/jpeg";
  if (!ALLOWED_MIME.has(normalizedMime)) return null;

  const buf = Buffer.from(await res.arrayBuffer());

  return uploadCompetitorAdImageBuffer(supabase, {
    brandId: params.brandId,
    competitorId: params.competitorId,
    userId: params.userId,
    buffer: buf,
    mime: normalizedMime,
    metadata: {
      source: "url",
      source_url: params.sourceUrl ?? resolved,
      fetched_image_url: resolved,
    },
  });
}

export async function linkAssetToCompetitorAd(
  supabase: SupabaseClient,
  params: {
    brandId: string;
    competitorAdId: string;
    assetId: string;
  }
): Promise<void> {
  const { error } = await supabase.from("competitor_ad_asset_links").insert({
    brand_id: params.brandId,
    competitor_ad_id: params.competitorAdId,
    asset_id: params.assetId,
    role: "primary",
  });
  if (error) {
    if (error.code === "23505") return; // duplicate link is fine
    throw new Error(error.message);
  }
}
