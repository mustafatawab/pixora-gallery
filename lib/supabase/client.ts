import { createBrowserClient } from "@supabase/ssr"
import { getSupabaseEnv } from "@/lib/supabase/env"
import type { Database } from "@/lib/types/database"

let supabaseClient: ReturnType<typeof createBrowserClient<Database>> | null = null

export function createClient() {
  if (!supabaseClient) {
    const { url, anonKey } = getSupabaseEnv()
    supabaseClient = createBrowserClient<Database>(url, anonKey)
  }
  return supabaseClient
}
