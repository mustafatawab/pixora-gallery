/**
 * Feed visibility behaviour against the local Supabase stack.
 *
 * This complements the RLS matrix in visibility.test.ts by exercising the
 * exact query shape the home feed uses (public filter + owner join) and the
 * owner-driven visibility toggle that Phase 4 adds.
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
const password = "password123"

const users = {
  a: { email: `feed-a-${suffix}@example.com`, username: `feed_a_${suffix}`, fullName: "Feed User A" },
  b: { email: `feed-b-${suffix}@example.com`, username: `feed_b_${suffix}`, fullName: "Feed User B" },
}

type TestUser = { id: string; email: string; client: SupabaseClient }

let a: TestUser
let b: TestUser
let createdUserIds: string[] = []

const aPublicId = crypto.randomUUID()
const aPrivateId = crypto.randomUUID()
const bPublicId = crypto.randomUUID()

const imageIds = [aPublicId, aPrivateId, bPublicId]

async function createUser(user: { email: string; username: string; fullName: string }): Promise<TestUser> {
  const { data, error } = await admin.auth.admin.createUser({
    email: user.email,
    password,
    email_confirm: true,
    user_metadata: { username: user.username, full_name: user.fullName },
  })
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`)

  createdUserIds.push(data.user.id)

  const client = makeClient(ANON_KEY)
  const { error: signInError } = await client.auth.signInWithPassword({ email: user.email, password })
  if (signInError) throw new Error(`signIn failed: ${signInError.message}`)

  return { id: data.user.id, email: user.email, client }
}

function feedQuery(client: SupabaseClient) {
  return client
    .from("images")
    .select("id, visibility, owner:profiles!images_owner_id_fkey(username)")
    .eq("visibility", "public")
    .in("id", imageIds)
}

async function publicIds(client: SupabaseClient): Promise<string[]> {
  const { data, error } = await feedQuery(client)
  if (error) throw new Error(`feed query failed: ${error.message}`)
  return (data ?? []).map((row) => row.id).sort()
}

beforeAll(async () => {
  a = await createUser(users.a)
  b = await createUser(users.b)

  const { error } = await a.client.from("images").insert([
    {
      id: aPublicId,
      owner_id: a.id,
      title: "Feed public",
      storage_path: `${a.id}/${aPublicId}.jpg`,
      mime_type: "image/jpeg",
      visibility: "public",
      category: "nature",
    },
    {
      id: aPrivateId,
      owner_id: a.id,
      title: "Feed private",
      storage_path: `${a.id}/${aPrivateId}.jpg`,
      mime_type: "image/jpeg",
      visibility: "private",
      category: "nature",
    },
  ])
  if (error) throw new Error(`image setup failed: ${error.message}`)

  const { error: bError } = await b.client.from("images").insert({
    id: bPublicId,
    owner_id: b.id,
    title: "Other public",
    storage_path: `${b.id}/${bPublicId}.jpg`,
    mime_type: "image/jpeg",
    visibility: "public",
    category: "street",
  })
  if (bError) throw new Error(`image setup failed: ${bError.message}`)
})

afterAll(async () => {
  for (const id of createdUserIds) {
    await admin.auth.admin.deleteUser(id)
  }
})

describe("public feed", () => {
  it("returns only public rows to anonymous visitors and joins the owner", async () => {
    const { data, error } = await feedQuery(anon)

    expect(error).toBeNull()
    expect((data ?? []).map((row) => row.id).sort()).toEqual([aPublicId, bPublicId].sort())

    const owner = data?.find((row) => row.id === aPublicId)?.owner as unknown
    const normalized = Array.isArray(owner) ? owner[0] : owner
    expect(normalized?.username).toBe(users.a.username)
  })

  it("hides private rows from other signed-in users", async () => {
    expect(await publicIds(b.client)).toEqual([aPublicId, bPublicId].sort())
  })

  it("lets the owner see their private row outside the public feed", async () => {
    const { data, error } = await a.client
      .from("images")
      .select("id, visibility")
      .in("id", imageIds)
      .eq("owner_id", a.id)

    expect(error).toBeNull()
    expect(data?.map((row) => row.id).sort()).toEqual([aPublicId, aPrivateId].sort())
  })
})

describe("visibility toggle", () => {
  it("makes a private image appear in the anonymous feed", async () => {
    expect(await publicIds(anon)).not.toContain(aPrivateId)

    const { data, error } = await a.client
      .from("images")
      .update({ visibility: "public" })
      .eq("id", aPrivateId)
      .eq("owner_id", a.id)
      .select("id, visibility")
      .single()

    expect(error).toBeNull()
    expect(data?.visibility).toBe("public")
    expect(await publicIds(anon)).toContain(aPrivateId)
  })

  it("removes a public image from the anonymous feed again", async () => {
    const { data, error } = await a.client
      .from("images")
      .update({ visibility: "private" })
      .eq("id", aPrivateId)
      .eq("owner_id", a.id)
      .select("id, visibility")
      .single()

    expect(error).toBeNull()
    expect(data?.visibility).toBe("private")
    expect(await publicIds(anon)).not.toContain(aPrivateId)
  })

  it("does not let another user toggle someone else's image", async () => {
    const { data, error } = await b.client
      .from("images")
      .update({ visibility: "private" })
      .eq("id", aPublicId)
      .select("id")

    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(0)
    expect(await publicIds(anon)).toContain(aPublicId)
  })
})
