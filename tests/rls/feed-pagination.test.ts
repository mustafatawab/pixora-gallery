/**
 * Feed search + pagination against the local Supabase stack.
 *
 * Exercises the `search_public_images` RPC that the home feed uses: total
 * count, stable ordering, category/tag/owner search, and private-row isolation.
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
const email = `feed-page-${suffix}@example.com`
const username = `feed_page_${suffix}`
const password = "password123"
const prefix = `Pagination ${suffix}`
const category = `cat_${suffix}`
const tag = `tag_${suffix}`

let userId: string | null = null
const imageIds: string[] = []

type InsertRow = {
  id: string
  owner_id: string
  title: string
  description: string | null
  storage_path: string
  mime_type: string
  visibility: "public" | "private"
  category: string
  tags: string[]
  created_at: string
}

beforeAll(async () => {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username, full_name: `Pagination ${suffix}` },
  })
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`)

  const ownerId = data.user.id
  userId = ownerId

  const now = Date.now()
  const rows: InsertRow[] = Array.from({ length: 5 }, (_, index) => {
    const id = crypto.randomUUID()
    imageIds.push(id)

    return {
      id,
      owner_id: ownerId,
      title: `${prefix} ${index + 1}`,
      description: index === 0 ? `Description with ${tag}` : null,
      storage_path: `${ownerId}/${id}.jpg`,
      mime_type: "image/jpeg",
      visibility: "public",
      category: index < 2 ? category : "street",
      tags: index < 2 ? [tag] : [],
      // index 0 is the newest; ordering is created_at desc.
      created_at: new Date(now - index * 60_000).toISOString(),
    }
  })

  const privateId = crypto.randomUUID()
  imageIds.push(privateId)
  rows.push({
    id: privateId,
    owner_id: ownerId,
    title: `${prefix} private`,
    description: null,
    storage_path: `${ownerId}/${privateId}.jpg`,
    mime_type: "image/jpeg",
    visibility: "private",
    category,
    tags: [],
    created_at: new Date(now + 60_000).toISOString(),
  })

  const { error: insertError } = await admin.from("images").insert(rows)
  if (insertError) throw new Error(`insert failed: ${insertError.message}`)
})

afterAll(async () => {
  if (userId) await admin.auth.admin.deleteUser(userId)
})

type FeedRow = {
  id: string
  title: string
  category: string | null
  owner_username: string
  total_count: number
}

async function search(overrides: Record<string, unknown> = {}): Promise<FeedRow[]> {
  const { data, error } = await anon.rpc("search_public_images", {
    p_search: prefix,
    p_category: "",
    p_limit: 24,
    p_offset: 0,
    ...overrides,
  })
  if (error) throw new Error(`rpc failed: ${error.message}`)
  return (data ?? []) as FeedRow[]
}

describe("public feed pagination", () => {
  it("returns a page and the total count in one call", async () => {
    const rows = await search({ p_limit: 2, p_offset: 0 })

    expect(rows).toHaveLength(2)
    expect(Number(rows[0].total_count)).toBe(5)
    expect(rows.map((row) => row.title)).toEqual([`${prefix} 1`, `${prefix} 2`])
  })

  it("returns the remaining rows on the next page", async () => {
    const rows = await search({ p_limit: 2, p_offset: 4 })

    expect(rows).toHaveLength(1)
    expect(Number(rows[0].total_count)).toBe(5)
    expect(rows[0].title).toBe(`${prefix} 5`)
  })

  it("returns no rows past the last page", async () => {
    expect(await search({ p_limit: 2, p_offset: 100 })).toEqual([])
  })

  it("filters by category and keeps the total accurate", async () => {
    const rows = await search({ p_category: category })

    expect(rows).toHaveLength(2)
    expect(rows.every((row) => row.category === category)).toBe(true)
    expect(Number(rows[0].total_count)).toBe(2)
  })

  it("searches tags and owner usernames", async () => {
    const byTag = await search({ p_search: tag })
    expect(byTag).toHaveLength(2)
    expect(Number(byTag[0].total_count)).toBe(2)

    const byOwner = await search({ p_search: username })
    expect(byOwner).toHaveLength(5)
    expect(byOwner.every((row) => row.owner_username === username)).toBe(true)
  })

  it("never returns the owner's private row to anonymous callers", async () => {
    const rows = await search({ p_limit: 100 })
    expect(rows.map((row) => row.id)).not.toContain(imageIds[imageIds.length - 1])
  })
})
