import { NextResponse, type NextRequest } from "next/server"
import { updateSession, type SessionCookie } from "@/lib/supabase/middleware"

const PROTECTED_PREFIXES = ["/upload", "/profile", "/settings"]
const AUTH_PAGES = new Set(["/login", "/register"])

function copyCookies(response: NextResponse, cookies: SessionCookie[]) {
  cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
  return response
}

export async function middleware(request: NextRequest) {
  const { response, user, cookiesToSet } = await updateSession(request)
  const { pathname, search } = request.nextUrl

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )

  if (!user && isProtected) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.search = ""
    url.searchParams.set("next", `${pathname}${search}`)
    return copyCookies(NextResponse.redirect(url), cookiesToSet)
  }

  if (user && AUTH_PAGES.has(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = "/"
    url.search = ""
    return copyCookies(NextResponse.redirect(url), cookiesToSet)
  }

  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)",
  ],
}
