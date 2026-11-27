import { describe, expect, it } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import { cleanupOrphanObjects } from "../../lib/storage/cleanup"
import type { Database } from "../../lib/types/database"

const owner = "11111111-1111-4111-8111-111111111111"

describe("cleanup safety", () => {
  it("deletes nothing when the metadata snapshot cannot be read", async () => {
    let removeCalled = false

    const storageApi = {
      list: async () => ({
        data: [
          {
            name: "orphan.jpg",
            id: "object-id",
            created_at: "2020-01-01T00:00:00.000Z",
            updated_at: "2020-01-01T00:00:00.000Z",
          },
        ],
        error: null,
      }),
      remove: async () => {
        removeCalled = true
        return { data: [], error: null }
      },
    }

    const db = {
      select: () => ({
        range: () => ({
          order: async () => ({ data: null, error: { message: "database unavailable" } }),
        }),
      }),
    }

    const client = {
      storage: { from: () => storageApi },
      from: () => db,
    } as unknown as SupabaseClient<Database>

    const result = await cleanupOrphanObjects(client, { rootPrefix: owner, minAgeMs: 0 })

    expect(result.scannedObjects).toBe(1)
    expect(result.orphansFound).toBe(0)
    expect(result.deleted).toBe(0)
    expect(result.errors[0]).toContain("database unavailable")
    expect(removeCalled).toBe(false)
  })
})
