import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import type { User } from "@supabase/supabase-js"
import { getSupabaseEnv } from "@/lib/supabase/env"
import type { Database } from "@/lib/types/database"

export type SessionCookie = {
  name: string
  value: string
  options: CookieOptions
}

/**
 * Refreshes the Supabase session and returns the user plus any cookies that
 * were rotated. Middleware must copy those cookies onto redirect responses,
 * otherwise a redirect can drop a freshly refreshed session.
 */
export async function updateSession(request: NextRequest): Promise<{
  response: NextResponse
  user: User | null
  cookiesToSet: SessionCookie[]
}> {
  const { url, anonKey } = getSupabaseEnv()

  let response = NextResponse.next({ request })
  const cookiesToSet: SessionCookie[] = []

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(toSet) {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        cookiesToSet.length = 0
        cookiesToSet.push(...toSet)
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  return { response, user, cookiesToSet }
}
