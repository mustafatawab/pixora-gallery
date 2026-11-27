/**
 * RLS / Storage policy matrix.
 *
 * Requires the local Supabase stack: `bun run db:start` then `bun run db:reset`.
 * Keys default to the standard local development values and can be overridden
 * with SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY.
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
  a: { email: `rls-a-${suffix}@example.com`, username: `rls_a_${suffix}`, fullName: "RLS User A" },
  b: { email: `rls-b-${suffix}@example.com`, username: `rls_b_${suffix}`, fullName: "RLS User B" },
}

type TestUser = {
  id: string
  email: string
  client: SupabaseClient
}

let a: TestUser
let b: TestUser
let createdUserIds: string[] = []
let storagePaths: string[] = []

const publicId = crypto.randomUUID()
const privateId = crypto.randomUUID()

const publicPath = () => `${a.id}/${publicId}.jpg`
const privatePath = () => `${a.id}/${privateId}.jpg`
const publicThumbPath = () => `${a.id}/${publicId}.thumb.jpg`
const privateThumbPath = () => `${a.id}/${privateId}.thumb.jpg`

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

beforeAll(async () => {
  a = await createUser(users.a)
  b = await createUser(users.b)

  const { error } = await a.client.from("images").insert([
    {
      id: publicId,
      owner_id: a.id,
      title: "Public test image",
      storage_path: publicPath(),
      thumbnail_path: publicThumbPath(),
      mime_type: "image/jpeg",
      visibility: "public",
      tags: ["test"],
    },
    {
      id: privateId,
      owner_id: a.id,
      title: "Private test image",
      storage_path: privatePath(),
      thumbnail_path: privateThumbPath(),
      mime_type: "image/jpeg",
      visibility: "private",
      tags: ["test"],
    },
  ])
  if (error) throw new Error(`image setup failed: ${error.message}`)

  const blob = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: "image/jpeg" })
  for (const path of [publicPath(), privatePath(), publicThumbPath(), privateThumbPath()]) {
    const { error: uploadError } = await a.client.storage
      .from("media")
      .upload(path, blob, { contentType: "image/jpeg", upsert: true })
    if (uploadError) throw new Error(`storage setup failed: ${uploadError.message}`)
    storagePaths.push(path)
  }
})

afterAll(async () => {
  if (storagePaths.length > 0) {
    await admin.storage.from("media").remove(storagePaths)
  }
  for (const id of createdUserIds) {
    await admin.auth.admin.deleteUser(id)
  }
})

describe("images RLS", () => {
  it("anonymous visitors see public images but not private ones", async () => {
    const { data, error } = await anon
      .from("images")
      .select("id, visibility")
      .in("id", [publicId, privateId])

    expect(error).toBeNull()
    expect(data).toEqual([{ id: publicId, visibility: "public" }])
  })

  it("other users see public images but not someone else's private ones", async () => {
    const { data, error } = await b.client
      .from("images")
      .select("id, visibility")
      .in("id", [publicId, privateId])

    expect(error).toBeNull()
    expect(data).toEqual([{ id: publicId, visibility: "public" }])
  })

  it("owners see their own public and private images", async () => {
    const { data, error } = await a.client
      .from("images")
      .select("id, visibility")
      .in("id", [publicId, privateId])
      .order("visibility")

    expect(error).toBeNull()
    expect(data?.map((row) => row.id).sort()).toEqual([publicId, privateId].sort())
  })

  it("cannot update another user's image", async () => {
    const { data, error } = await b.client
      .from("images")
      .update({ visibility: "private" })
      .eq("id", publicId)
      .select("id")

    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(0)

    const { data: stillPublic } = await anon
      .from("images")
      .select("id")
      .eq("id", publicId)
      .single()
    expect(stillPublic?.id).toBe(publicId)
  })

  it("cannot delete another user's image", async () => {
    const { data, error } = await b.client.from("images").delete().eq("id", publicId).select("id")

    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(0)

    const { data: stillThere } = await anon
      .from("images")
      .select("id")
      .eq("id", publicId)
      .single()
    expect(stillThere?.id).toBe(publicId)
  })

  it("cannot insert an image owned by someone else", async () => {
    const { error } = await b.client.from("images").insert({
      owner_id: a.id,
      title: "Spoofed owner",
      storage_path: `${a.id}/${crypto.randomUUID()}.jpg`,
      mime_type: "image/jpeg",
      visibility: "public",
    })

    expect(error).not.toBeNull()
  })

  it("cannot insert an image pointed at someone else's storage folder", async () => {
    const { error } = await a.client.from("images").insert({
      owner_id: a.id,
      title: "Spoofed path",
      storage_path: `${b.id}/${crypto.randomUUID()}.jpg`,
      mime_type: "image/jpeg",
      visibility: "public",
    })

    expect(error).not.toBeNull()
  })

  it("anonymous users cannot insert images", async () => {
    const { error } = await anon.from("images").insert({
      owner_id: a.id,
      title: "Anon upload",
      storage_path: `${a.id}/${crypto.randomUUID()}.jpg`,
      mime_type: "image/jpeg",
      visibility: "public",
    })

    expect(error).not.toBeNull()
  })
})

describe("storage RLS", () => {
  it("cannot upload into another user's folder", async () => {
    const blob = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: "image/jpeg" })
    const { error } = await b.client.storage
      .from("media")
      .upload(`${a.id}/${crypto.randomUUID()}.jpg`, blob, { contentType: "image/jpeg" })

    expect(error).not.toBeNull()
  })

  it("cannot delete another user's object", async () => {
    const { data, error } = await b.client.storage.from("media").remove([publicPath()])

    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(0)
  })

  it("mints signed URLs for public thumbnails to anonymous users", async () => {
    const { data, error } = await anon.storage.from("media").createSignedUrl(publicThumbPath(), 60)

    expect(error).toBeNull()
    expect(data?.signedUrl).toContain("token=")
  })

  it("refuses signed URLs for public originals to anonymous users", async () => {
    // Public reads are limited to the metadata-free derivative; the original
    // (which may contain EXIF/GPS) stays owner-only.
    const { data, error } = await anon.storage.from("media").createSignedUrl(publicPath(), 60)

    expect(error).not.toBeNull()
    expect(data?.signedUrl ?? null).toBeNull()
  })

  it("refuses signed URLs for private objects to anonymous users", async () => {
    const { data, error } = await anon.storage.from("media").createSignedUrl(privatePath(), 60)

    expect(error).not.toBeNull()
    expect(data?.signedUrl ?? null).toBeNull()
  })

  it("refuses signed URLs for private thumbnails to other users", async () => {
    const { data, error } = await b.client.storage.from("media").createSignedUrl(privateThumbPath(), 60)

    expect(error).not.toBeNull()
    expect(data?.signedUrl ?? null).toBeNull()
  })

  it("mints signed URLs for private originals to the owner", async () => {
    const { data, error } = await a.client.storage.from("media").createSignedUrl(privatePath(), 60)

    expect(error).toBeNull()
    expect(data?.signedUrl).toContain("token=")
  })
})
