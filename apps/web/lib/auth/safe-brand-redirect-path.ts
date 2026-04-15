const DEFAULT_REDIRECT = "/studio";

/**
 * Normalize a same-origin path for post-activation redirects.
 * Rejects protocol-relative and absolute URLs.
 */
export function safeBrandRedirectPath(input: string | undefined): string {
  const raw = (input ?? DEFAULT_REDIRECT).trim() || DEFAULT_REDIRECT;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\0") || raw.includes("://")) {
    return DEFAULT_REDIRECT;
  }
  try {
    const u = new URL(raw, "http://local.invalid");
    return `${u.pathname}${u.search}${u.hash}`;
  } catch {
    return DEFAULT_REDIRECT;
  }
}
