/** Resolve a possibly relative URL against the imported site base (same rules as image preview). */
export function resolveSiteAbsoluteUrl(
  raw: string | null | undefined,
  websiteUrl: string
): string | null {
  if (!raw?.trim()) return null;
  const r = raw.trim();
  if (r.startsWith("//")) return `https:${r}`;
  if (/^https?:\/\//i.test(r)) return r;
  try {
    const base = websiteUrl.trim().startsWith("http")
      ? websiteUrl.trim()
      : `https://${websiteUrl.trim()}`;
    return new URL(r, new URL(base).origin + "/").href;
  } catch {
    return null;
  }
}
