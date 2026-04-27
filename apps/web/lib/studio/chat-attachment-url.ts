/**
 * Server-side image fetches inside the AI pipeline (visual references for
 * `images.edit`, parent images during edit, etc.) are an SSRF vector if we
 * trust arbitrary URLs from the client. We restrict every server-side
 * `fetch(url)` of a user-controllable image URL to public Supabase Storage
 * objects under buckets we actually own.
 *
 * Anything outside this allowlist is rejected before we hit the network.
 */
const ALLOWED_BUCKETS = [
  "chat-attachments",
  "product-images",
  "creative-assets",
  "competitor-ads",
  "template-thumbnails",
] as const;

type AllowedBucket = (typeof ALLOWED_BUCKETS)[number];

function originMatches(url: URL, baseOrigin: string): boolean {
  return url.origin === baseOrigin;
}

function isPublicStoragePath(url: URL, bucket: string): boolean {
  return url.pathname.startsWith(`/storage/v1/object/public/${bucket}/`);
}

function getBaseOrigin(): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (!base) return null;
  try {
    return new URL(base).origin;
  } catch {
    return null;
  }
}

/**
 * Ensures chat attachment URLs are our public Supabase Storage URLs (mitigates SSRF).
 */
export function isAllowedChatAttachmentUrl(url: string): boolean {
  return isAllowedReferenceImageUrl(url, ["chat-attachments"]);
}

/**
 * Allowlist check used for ALL server-side image fetches in the AI pipeline.
 * Permits only public Supabase Storage URLs in the buckets we own. By default
 * accepts every owned bucket (chat-attachments, product-images, creative-assets,
 * competitor-ads, template-thumbnails); pass `allowedBuckets` to narrow.
 */
export function isAllowedReferenceImageUrl(
  url: string,
  allowedBuckets: ReadonlyArray<AllowedBucket> = ALLOWED_BUCKETS
): boolean {
  try {
    const u = new URL(url);
    const origin = getBaseOrigin();
    if (!origin) return false;
    if (!originMatches(u, origin)) return false;
    return allowedBuckets.some((bucket) => isPublicStoragePath(u, bucket));
  } catch {
    return false;
  }
}

export function filterAllowedAttachmentUrls(urls: string[] | undefined): string[] {
  if (!urls?.length) return [];
  return urls.filter(isAllowedChatAttachmentUrl).slice(0, 4);
}

/**
 * Filters an arbitrary list of candidate reference URLs down to the ones we
 * are willing to fetch server-side. Returns the safe subset and the rejected
 * URLs (so callers can log/warn — usually rejected URLs indicate a bug or a
 * malicious request).
 */
export function partitionAllowedReferenceImageUrls(
  urls: ReadonlyArray<string>,
  allowedBuckets: ReadonlyArray<AllowedBucket> = ALLOWED_BUCKETS
): { allowed: string[]; rejected: string[] } {
  const allowed: string[] = [];
  const rejected: string[] = [];
  for (const url of urls) {
    if (isAllowedReferenceImageUrl(url, allowedBuckets)) {
      allowed.push(url);
    } else {
      rejected.push(url);
    }
  }
  return { allowed, rejected };
}
