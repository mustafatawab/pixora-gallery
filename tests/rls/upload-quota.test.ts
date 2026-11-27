/**
 * Upload quota against the local Supabase stack.
 *
 * The limit is enforced inside `consume_upload_quota` (30 per rolling hour), so
 * the client cannot pass a larger limit or reset the counter.
 *
 * Requires: `bun run db:start` (and `bun run db:reset` for a clean seed).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321"
const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"

function makeClient(key: string): SupabaseClient {
  return createClient(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

const admin = makeClient(SERVICE_ROLE_KEY)
const anon = makeClient(ANON_KEY)

const suffix = Date.now().toString(36)
const email = `quota-${suffix}@example.com`
const username = `quota_${suffix}`
const password = "password123"
const LIMIT = 30

let userId: string | null = null
let client: SupabaseClient

type QuotaRow = {
  allowed: boolean
  used: number
  remaining: number
  reset_at: string | null
}

async function consume(target: SupabaseClient) {
  const { data, error } = await target.rpc("consume_upload_quota")
  if (error) throw new Error(`rpc failed: ${error.message}`)
  const row = Array.isArray(data) ? data[0] : data
  if (!row) throw new Error("rpc returned no row")
  return row as QuotaRow
}

beforeAll(async () => {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username, full_name: "Quota Tester" },
  })
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`)
  userId = data.user.id

  client = makeClient(ANON_KEY)
  const { error: signInError } = await client.auth.signInWithPassword({ email, password })
  if (signInError) throw new Error(`signIn failed: ${signInError.message}`)
})

afterAll(async () => {
  if (userId) await admin.auth.admin.deleteUser(userId)
})

describe("upload quota", () => {
  it("allows the first upload and reports the remaining budget", async () => {
    const first = await consume(client)

    expect(first.allowed).toBe(true)
    expect(first.used).toBe(1)
    expect(first.remaining).toBe(LIMIT - 1)
    expect(first.reset_at).toBeTruthy()
  })

  it("blocks the 31st upload in the same window", async () => {
    for (let attempt = 2; attempt <= LIMIT; attempt += 1) {
      const row = await consume(client)
      expect(row.allowed).toBe(true)
      expect(row.used).toBe(attempt)
    }

    const blocked = await consume(client)
    expect(blocked.allowed).toBe(false)
    expect(blocked.used).toBe(LIMIT)
    expect(blocked.remaining).toBe(0)
    expect(blocked.reset_at).toBeTruthy()
  })

  it("is not callable by anonymous visitors", async () => {
    const { error } = await anon.rpc("consume_upload_quota")
    expect(error).not.toBeNull()
  })
})
