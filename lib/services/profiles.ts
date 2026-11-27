import "server-only"

import { cache } from "react"
import { createClient } from "@/lib/supabase/server"
import { usernameSchema } from "@/lib/validation/auth"
import type { Profile } from "@/lib/types/domain"

/**
 * Public profile lookup. Invalid usernames are treated as missing instead of
 * reaching Postgres, which keeps malformed URLs cheap and predictable.
 */
export const getProfileByUsername = cache(async (username: string): Promise<Profile | null> => {
  const parsed = usernameSchema.safeParse(username)
  if (!parsed.success) return null

  const supabase = await createClient()
  const { data, error } = await supabase.from("profiles").select("*").eq("username", parsed.data).maybeSingle()

  if (error) {
    console.error("[profiles] could not load a public profile", { username: parsed.data, error: error.message })
    throw new Error("Could not load this profile.")
  }

  return data
})
