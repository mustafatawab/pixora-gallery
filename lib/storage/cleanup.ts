import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/types/database"

/**
 * Removes Storage objects that have no matching `images.storage_path` or
 * `images.thumbnail_path`.
 *
 * Uploads are direct-to-Storage, so a browser can create an object and then fail
 * before the metadata action runs. Those objects are invisible to the app but
 * still billed. This job is intentionally conservative: it only deletes objects
 * older than `minAgeMs`, so an upload that is still in flight is never touched.
 *
 * The caller must pass a service-role client (see `lib/supabase/admin.ts`).
 */

const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000
const DELETE_BATCH_SIZE = 100
const MAX_PAGES_PER_FOLDER = 1000
const MAX_FOLDER_DEPTH = 10

export const ORPHAN_MAX_AGE_MS = DEFAULT_MAX_AGE_MS

type AdminClient = SupabaseClient<Database>
type StorageBucket = ReturnType<AdminClient["storage"]["from"]>

type ListedObject = {
  path: string
  createdAt: number | null
}

export type CleanupOptions = {
  bucket?: string
  /** Objects newer than this are left alone. Defaults to 24 hours. */
  minAgeMs?: number
  /** Limit the scan to one prefix (used by tests). Defaults to the bucket root. */
  rootPrefix?: string
  /** Injectable clock for tests. */
  now?: Date
  pageSize?: number
}

export type CleanupResult = {
  scannedObjects: number
  trackedObjects: number
  orphansFound: number
  deleted: number
  failed: number
  errors: string[]
}

function normalizePrefix(prefix: string): string {
  return prefix.replace(/^\/+|\/+$/g, "")
}

function parseTimestamp(value: string | null): number | null {
  if (!value) return null
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : null
}

async function walkFolder(
  storage: StorageBucket,
  prefix: string,
  depth: number,
  pageSize: number,
  objects: ListedObject[],
  errors: string[],
): Promise<void> {
  if (depth > MAX_FOLDER_DEPTH) {
    errors.push(`Maximum folder depth exceeded at "${prefix || "/"}"`)
    return
  }

  let offset = 0
  for (let page = 0; page < MAX_PAGES_PER_FOLDER; page += 1) {
    const { data, error } = await storage.list(prefix, {
      limit: pageSize,
      offset,
      sortBy: { column: "name", order: "asc" },
    })

    if (error) {
      errors.push(`Could not list "${prefix || "/"}": ${error.message}`)
      return
    }

    const entries = data ?? []
    if (entries.length === 0) return

    for (const entry of entries) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name

      if (entry.id === null) {
        await walkFolder(storage, path, depth + 1, pageSize, objects, errors)
        continue
      }

      objects.push({
        path,
        createdAt: parseTimestamp(entry.created_at) ?? parseTimestamp(entry.updated_at),
      })
    }

    if (entries.length < pageSize) return
    offset += entries.length
  }

  errors.push(`Pagination limit reached for "${prefix || "/"}"`)
}

async function loadTrackedPaths(
  client: AdminClient,
  pageSize: number,
  errors: string[],
): Promise<Set<string> | null> {
  const paths = new Set<string>()
  let from = 0

  for (let page = 0; page < MAX_PAGES_PER_FOLDER; page += 1) {
    const { data, error } = await client
      .from("images")
      .select("storage_path, thumbnail_path")
      .range(from, from + pageSize - 1)
      .order("id", { ascending: true })

    if (error) {
      errors.push(`Could not read image metadata: ${error.message}`)
      return null
    }

    const rows = data ?? []
    for (const row of rows) {
      paths.add(row.storage_path)
      if (row.thumbnail_path) paths.add(row.thumbnail_path)
    }

    if (rows.length < pageSize) return paths
    from += rows.length
  }

  errors.push("Pagination limit reached while reading image metadata")
  return null
}

export async function cleanupOrphanObjects(
  client: AdminClient,
  options: CleanupOptions = {},
): Promise<CleanupResult> {
  const bucket = options.bucket ?? "media"
  const minAgeMs = options.minAgeMs ?? DEFAULT_MAX_AGE_MS
  const pageSize = Math.min(Math.max(options.pageSize ?? 100, 1), 1000)
  const now = (options.now ?? new Date()).getTime()
  const rootPrefix = normalizePrefix(options.rootPrefix ?? "")
  const errors: string[] = []

  const storage = client.storage.from(bucket)
  const objects: ListedObject[] = []
  await walkFolder(storage, rootPrefix, 0, pageSize, objects, errors)

  const tracked = await loadTrackedPaths(client, pageSize, errors)

  // Fail closed: without a complete metadata snapshot we cannot prove any
  // object is orphaned, so delete nothing.
  if (!tracked) {
    return {
      scannedObjects: objects.length,
      trackedObjects: 0,
      orphansFound: 0,
      deleted: 0,
      failed: 0,
      errors,
    }
  }

  const cutoff = now - minAgeMs

  const orphans = objects
    .filter((object) => {
      if (tracked.has(object.path)) return false
      if (object.createdAt === null) return false
      return object.createdAt <= cutoff
    })
    .map((object) => object.path)

  let deleted = 0
  let failed = 0

  for (let index = 0; index < orphans.length; index += DELETE_BATCH_SIZE) {
    const batch = orphans.slice(index, index + DELETE_BATCH_SIZE)
    const { error } = await storage.remove(batch)

    if (error) {
      failed += batch.length
      errors.push(`Could not delete ${batch.length} orphaned object(s): ${error.message}`)
      continue
    }

    deleted += batch.length
  }

  return {
    scannedObjects: objects.length,
    trackedObjects: tracked.size,
    orphansFound: orphans.length,
    deleted,
    failed,
    errors,
  }
}
