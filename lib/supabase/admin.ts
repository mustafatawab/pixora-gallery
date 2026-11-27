import "server-only"

import { createClient } from "@supabase/supabase-js"
import { getSupabaseEnv } from "@/lib/supabase/env"
import type { Database } from "@/lib/types/database"

/**
 * Service-role client for background jobs only. It bypasses RLS, so it must
 * never be imported into a client component or route that accepts user input
 * without its own authorization check.
 */
export function createAdminClient() {
  const { url } = getSupabaseEnv()
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY. The cleanup job needs a server-only service role key.",
    )
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}
