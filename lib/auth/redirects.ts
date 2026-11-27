const FALLBACK = "/"
const AUTH_PATHS = new Set(["/login", "/register"])

/**
 * Accepts only same-origin relative paths. Rejects absolute URLs, protocol
 * relative URLs (`//evil.com`), backslash tricks and auth pages (redirect loops).
 */
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw) return FALLBACK

  try {
    const base = "https://pixora.invalid"
    const url = new URL(raw, base)

    if (url.origin !== base) return FALLBACK
    if (!url.pathname.startsWith("/")) return FALLBACK
    if (AUTH_PATHS.has(url.pathname)) return FALLBACK

    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return FALLBACK
  }
}
