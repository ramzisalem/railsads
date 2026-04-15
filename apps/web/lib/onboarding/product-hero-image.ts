import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "creative-assets";
const MAX_BYTES = 6 * 1024 * 1024;

export function assertSafeImageFetchUrl(url: string): URL {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new Error("Invalid image URL");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("Invalid URL scheme");
  }
  const h = u.hostname.toLowerCase();
  if (
    h === "localhost" ||
    h === "0.0.0.0" ||
    h === "[::1]" ||
    h.endsWith(".localhost") ||
    h.endsWith(".local") ||
    h.endsWith(".internal")
  ) {
    throw new Error("Blocked host");
  }
  if (h === "127.0.0.1" || h.startsWith("10.")) throw new Error("Blocked host");
  if (h.startsWith("192.168.")) throw new Error("Blocked host");
  if (h.startsWith("169.254.")) throw new Error("Blocked host");
  const m = /^172\.(\d+)\./.exec(h);
  if (m) {
    const n = parseInt(m[1], 10);
    if (n >= 16 && n <= 31) throw new Error("Blocked host");
  }
  return u;
}

export function resolveProductImageUrl(
  imageUrl: string,
  opts: { siteOrigin?: string | null; productUrl?: string | null }
): string {
  const raw = imageUrl.trim();
  if (!raw) throw new Error("Empty image URL");
  if (raw.startsWith("//")) return `https:${raw}`;
  if (/^https?:\/\//i.test(raw)) return raw;

  const baseCandidates = [opts.productUrl, opts.siteOrigin].filter(
    (s): s is string => Boolean(s?.trim())
  );
  for (const base of baseCandidates) {
    try {
      return new URL(raw, base.trim()).href;
    } catch {
      /* try next */
    }
  }
  throw new Error("Cannot resolve relative image URL (missing site base)");
}

function extFromMime(mime: string | null): string {
  const m = (mime ?? "").toLowerCase();
  if (m.includes("jpeg") || m.includes("jpg")) return "jpg";
  if (m.includes("png")) return "png";
  if (m.includes("webp")) return "webp";
  if (m.includes("gif")) return "gif";
  return "jpg";
}

export async function storeProductHeroFromUrl(
  admin: SupabaseClient,
  params: {
    brandId: string;
    productId: string;
    userId: string;
    imageUrl: string;
    siteOrigin?: string | null;
    productUrl?: string | null;
  }
): Promise<void> {
  const resolved = resolveProductImageUrl(params.imageUrl, {
    siteOrigin: params.siteOrigin,
    productUrl: params.productUrl,
  });
  assertSafeImageFetchUrl(resolved);

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 20_000);
  const res = await fetch(resolved, {
    signal: controller.signal,
    headers: {
      Accept: "image/*",
      "User-Agent":
        "Mozilla/5.0 (compatible; RailsAds/1.0; +https://railsads.com)",
    },
  });
  clearTimeout(t);

  if (!res.ok) {
    throw new Error(`Image fetch failed (${res.status})`);
  }

  const mime = res.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
  if (mime && !mime.startsWith("image/")) {
    throw new Error("URL did not return an image");
  }

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength === 0) throw new Error("Empty image body");
  if (buf.byteLength > MAX_BYTES) throw new Error("Image too large");

  const ext = extFromMime(mime || null);
  const storagePath = `products/${params.productId}/hero-${Date.now()}.${ext}`;

  const { error: upErr } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, buf, {
      contentType: mime || `image/${ext === "jpg" ? "jpeg" : ext}`,
      upsert: false,
    });
  if (upErr) throw new Error(upErr.message);

  const { data: asset, error: assetErr } = await admin
    .from("assets")
    .insert({
      brand_id: params.brandId,
      kind: "product_image",
      bucket: BUCKET,
      storage_path: storagePath,
      mime_type: mime || undefined,
      file_size_bytes: buf.byteLength,
      metadata: { source: "website_import", source_url: resolved },
      created_by: params.userId,
    })
    .select("id")
    .single();

  if (assetErr || !asset) {
    await admin.storage.from(BUCKET).remove([storagePath]);
    throw new Error(assetErr?.message ?? "Failed to create asset");
  }

  const { error: linkErr } = await admin.from("product_asset_links").insert({
    brand_id: params.brandId,
    product_id: params.productId,
    asset_id: asset.id,
    role: "primary",
    sort_order: 0,
  });

  if (linkErr) {
    await admin.from("assets").delete().eq("id", asset.id);
    await admin.storage.from(BUCKET).remove([storagePath]);
    throw new Error(linkErr.message);
  }
}
