/**
 * Signed URL lifetimes. Public links are re-minted on each render and stay valid
 * for a day; private links are owner-only and short-lived by design.
 */
export const PUBLIC_SIGNED_URL_TTL_SECONDS = 60 * 60 * 24
export const PRIVATE_SIGNED_URL_TTL_SECONDS = 60 * 60
