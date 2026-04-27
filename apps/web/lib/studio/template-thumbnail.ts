import type { SupabaseClient } from "@supabase/supabase-js";

export const TEMPLATE_THUMBNAIL_BUCKET = "template-thumbnails";

/**
 * Templates store either an absolute URL (legacy / brand-uploaded rows that
 * went through the upload API) or a bucket-relative path like
 * `system/benefits-grid.png` (system templates seeded by migration). Both
 * the Studio side panel (Next/Image) and the AI image-generation pipeline
 * (gpt-image-1 reference fetch) need an absolute URL, so resolve once on
 * the server and pass the absolute value down.
 */
export function resolveTemplateThumbnailUrl(
  supabase: SupabaseClient,
  raw: string | null | undefined
): string | null {
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  const path = raw.replace(/^\/+/, "");
  const { data } = supabase.storage
    .from(TEMPLATE_THUMBNAIL_BUCKET)
    .getPublicUrl(path);
  return data?.publicUrl ?? null;
}
