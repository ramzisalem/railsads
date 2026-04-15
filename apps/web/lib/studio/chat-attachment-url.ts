/**
 * Ensures chat attachment URLs are our public Supabase Storage URLs (mitigates SSRF).
 */
export function isAllowedChatAttachmentUrl(url: string): boolean {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (!base) return false;
  try {
    const u = new URL(url);
    const b = new URL(base);
    if (u.origin !== b.origin) return false;
    return u.pathname.startsWith("/storage/v1/object/public/chat-attachments/");
  } catch {
    return false;
  }
}

export function filterAllowedAttachmentUrls(urls: string[] | undefined): string[] {
  if (!urls?.length) return [];
  return urls.filter(isAllowedChatAttachmentUrl).slice(0, 4);
}
