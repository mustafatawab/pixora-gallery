import { NextResponse, type NextRequest } from "next/server"
import type { EmailOtpType } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { safeNextPath } from "@/lib/auth/redirects"

function redirectTo(request: NextRequest, next: string) {
  const forwardedHost = request.headers.get("x-forwarded-host")
  const forwardedProto = request.headers.get("x-forwarded-proto")
  const hostname = request.nextUrl.hostname
  const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1"

  // Local `next start` runs with NODE_ENV=production but is still served over
  // HTTP. Trusting x-forwarded-host there would redirect to https://localhost.
  if (isLocalHost || !forwardedHost) {
    return NextResponse.redirect(`${request.nextUrl.origin}${next}`)
  }

  const protocol = forwardedProto === "http" ? "http" : "https"
  return NextResponse.redirect(`${protocol}://${forwardedHost}${next}`)
}

/**
 * Handles both PKCE (`code`) and token-hash email confirmation links.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get("code")
  const tokenHash = searchParams.get("token_hash")
  const type = searchParams.get("type") as EmailOtpType | null
  const next = safeNextPath(searchParams.get("next"))

  if (searchParams.get("error") || searchParams.get("error_description")) {
    return NextResponse.redirect(new URL("/login?error=auth_callback_failed", request.url))
  }

  const supabase = await createClient()

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return redirectTo(request, next)
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (!error) return redirectTo(request, next)
  }

  return NextResponse.redirect(new URL("/login?error=auth_callback_failed", request.url))
}
