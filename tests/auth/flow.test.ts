/**
 * Auth flow against the local Supabase stack.
 *
 * Requires: `bun run db:start` (and `bun run db:reset` for a clean seed).
 */
import { afterAll, describe, expect, it } from "vitest"
import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321"
const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})

function makeClient() {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

const suffix = Date.now().toString(36)
const email = `auth-flow-${suffix}@example.com`
const username = `auth_${suffix}`
const password = "password123"
const userIds: string[] = []

afterAll(async () => {
  for (const id of userIds) {
    await admin.auth.admin.deleteUser(id)
  }
})

describe("auth flow", () => {
  it("registers a user and provisions a profile", async () => {
    const client = makeClient()
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: { data: { username, full_name: "Auth Flow" } },
    })

    expect(error).toBeNull()
    expect(data.user).toBeTruthy()

    const id = data.user!.id
    userIds.push(id)

    // Local stack has email confirmations off; if enabled, confirm via admin.
    if (!data.session) {
      const { error: confirmError } = await admin.auth.admin.updateUserById(id, { email_confirm: true })
      expect(confirmError).toBeNull()
    }

    const { data: profile, error: profileError } = await makeClient()
      .from("profiles")
      .select("id, username, full_name")
      .eq("id", id)
      .single()

    expect(profileError).toBeNull()
    expect(profile).toEqual({ id, username, full_name: "Auth Flow" })
  })

  it("rejects a duplicate username at the database level", async () => {
    const { error } = await admin.auth.admin.createUser({
      email: `auth-dup-${suffix}@example.com`,
      password,
      email_confirm: true,
      user_metadata: { username, full_name: "Duplicate" },
    })

    expect(error).not.toBeNull()

    if (error) {
      const { data } = await admin.auth.admin.listUsers()
      const orphan = data.users.find((user) => user.email === `auth-dup-${suffix}@example.com`)
      if (orphan) await admin.auth.admin.deleteUser(orphan.id)
    }
  })

  it("signs in, verifies the session, and signs out", async () => {
    const client = makeClient()

    const { error: badPasswordError } = await client.auth.signInWithPassword({
      email,
      password: "wrong-password",
    })
    expect(badPasswordError).not.toBeNull()

    const { data, error } = await client.auth.signInWithPassword({ email, password })
    expect(error).toBeNull()
    expect(data.session).toBeTruthy()

    const { data: userData, error: userError } = await client.auth.getUser()
    expect(userError).toBeNull()
    expect(userData.user?.email).toBe(email)

    const { error: signOutError } = await client.auth.signOut()
    expect(signOutError).toBeNull()

    const { data: afterSignOut } = await client.auth.getUser()
    expect(afterSignOut.user).toBeNull()
  })
})
