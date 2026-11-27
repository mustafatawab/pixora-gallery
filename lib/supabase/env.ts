export type SupabaseEnv = {
  url: string
  anonKey: string
}

/**
 * Reads the public Supabase configuration. Used by browser, server and
 * middleware clients, so it must not import server-only modules.
 */
export function getSupabaseEnv(): SupabaseEnv {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error(
      "Missing Supabase environment variables. Add NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local (see docs/environments.md).",
    )
  }

  return { url, anonKey }
}
