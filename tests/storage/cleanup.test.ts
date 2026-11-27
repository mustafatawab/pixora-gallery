/**
 * Orphan cleanup against the local Supabase stack.
 *
 * Requires: `bun run db:start` (and `bun run db:reset` for a clean seed).
 * The scan is scoped to a throwaway user's folder so it can run alongside the
 * other integration suites without touching unrelated objects.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { cleanupOrphanObjects } from "../../lib/storage/cleanup"
import type { Database } from "../../lib/types/database"

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321"
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"

const admin = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})

const suffix = Date.now().toString(36)
const email = `cleanup-${suffix}@example.com`
const username = `cleanup_${suffix}`
const password = "password123"

let userId: string | null = null
let orphanPath = ""
let trackedPath = ""
let trackedThumbPath = ""

const blob = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: "image/jpeg" })

async function listNames(client: SupabaseClient<Database>, prefix: string): Promise<string[]> {
  const { data, error } = await client.storage.from("media").list(prefix, { limit: 100 })
  if (error) throw new Error(`list failed: ${error.message}`)
  return (data ?? []).filter((entry) => entry.id !== null).map((entry) => entry.name)
}

beforeAll(async () => {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username, full_name: "Cleanup Tester" },
  })
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`)

  userId = data.user.id
  const imageId = crypto.randomUUID()
  orphanPath = `${userId}/${crypto.randomUUID()}.jpg`
  trackedPath = `${userId}/${imageId}.jpg`
  trackedThumbPath = `${userId}/${imageId}.thumb.jpg`

  for (const path of [orphanPath, trackedPath, trackedThumbPath]) {
    const { error: uploadError } = await admin.storage
      .from("media")
      .upload(path, blob, { contentType: "image/jpeg", upsert: true })
    if (uploadError) throw new Error(`upload failed: ${uploadError.message}`)
  }

  const { error: insertError } = await admin.from("images").insert({
    id: imageId,
    owner_id: userId,
    title: "Tracked cleanup image",
    storage_path: trackedPath,
    thumbnail_path: trackedThumbPath,
    mime_type: "image/jpeg",
    visibility: "private",
  })
  if (insertError) throw new Error(`insert failed: ${insertError.message}`)
})

afterAll(async () => {
  if (!userId) return

  const names = await listNames(admin, userId).catch(() => [])
  if (names.length > 0) {
    await admin.storage.from("media").remove(names.map((name) => `${userId}/${name}`))
  }
  await admin.auth.admin.deleteUser(userId)
})

describe("orphan cleanup", () => {
  it("keeps recent objects, then removes only the untracked older one", async () => {
    if (!userId) throw new Error("setup failed")

    const recent = await cleanupOrphanObjects(admin, {
      rootPrefix: userId,
      minAgeMs: 24 * 60 * 60 * 1000,
    })

    expect(recent.errors).toEqual([])
    expect(recent.scannedObjects).toBe(3)
    expect(recent.trackedObjects).toBeGreaterThanOrEqual(2)
    expect(recent.orphansFound).toBe(0)
    expect(recent.deleted).toBe(0)

    const before = await listNames(admin, userId)
    expect(before.sort()).toEqual(
      [orphanPath.split("/")[1], trackedPath.split("/")[1], trackedThumbPath.split("/")[1]].sort(),
    )

    const cleanup = await cleanupOrphanObjects(admin, {
      rootPrefix: userId,
      minAgeMs: 0,
      now: new Date(Date.now() + 60_000),
    })

    expect(cleanup.errors).toEqual([])
    expect(cleanup.scannedObjects).toBe(3)
    expect(cleanup.orphansFound).toBe(1)
    expect(cleanup.deleted).toBe(1)
    expect(cleanup.failed).toBe(0)

    const after = await listNames(admin, userId)
    expect(after.sort()).toEqual([trackedPath.split("/")[1], trackedThumbPath.split("/")[1]].sort())

    const { data: row } = await admin
      .from("images")
      .select("storage_path, thumbnail_path")
      .eq("storage_path", trackedPath)
      .maybeSingle()
    expect(row?.storage_path).toBe(trackedPath)
    expect(row?.thumbnail_path).toBe(trackedThumbPath)
  })
})
