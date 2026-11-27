const isDev = process.env.NODE_ENV !== "production"
// HSTS must only be sent by an HTTPS deployment. Local `next start` runs in
// production mode over http, and Chrome would upgrade localhost to https.
const enableHsts = process.env.VERCEL === "1" || process.env.ENABLE_HSTS === "true"

/**
 * Supabase origins are needed for Auth/REST/Storage calls and for the signed
 * image URLs. Derive them from the public URL at build time; fall back to the
 * hosted wildcard so a missing env var does not silently break the CSP.
 */
function supabaseOrigins() {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL

  if (raw) {
    try {
      const url = new URL(raw)
      const socketProtocol = url.protocol === "https:" ? "wss:" : "ws:"
      return [url.origin, `${socketProtocol}//${url.host}`]
    } catch {
      // Fall through to the hosted defaults below.
    }
  }

  return ["https://*.supabase.co", "wss://*.supabase.co"]
}

const supabase = supabaseOrigins()
const devConnections = isDev
  ? ["http://localhost:*", "http://127.0.0.1:*", "ws://localhost:*", "ws://127.0.0.1:*"]
  : []

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  // Tailwind and Radix use inline styles/attributes, so unsafe-inline is
  // required for styles. Scripts are constrained to self + inline Next runtime.
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' blob: data: ${supabase.join(" ")}`,
  `media-src 'self' blob: ${supabase.join(" ")}`,
  "font-src 'self' data:",
  `connect-src 'self' ${supabase.join(" ")} ${devConnections.join(" ")}`.trim(),
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ")

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  ...(enableHsts
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
    : []),
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  async redirects() {
    return [
      { source: "/auth/login", destination: "/login", permanent: false },
      { source: "/auth/signup", destination: "/register", permanent: false },
    ]
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ]
  },
  images: {
    // Signed Storage URLs change on every render, so the Next image optimizer
    // cannot cache them. Previews are already bounded derivatives.
    unoptimized: true,
  },
}

export default nextConfig
