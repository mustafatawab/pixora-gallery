import "server-only"

import { createClient } from "@/lib/supabase/server"
import { PRIVATE_SIGNED_URL_TTL_SECONDS, PUBLIC_SIGNED_URL_TTL_SECONDS } from "@/lib/storage/urls"
import type { Database } from "@/lib/types/database"
import type { FeedImage, ImageRecord, OwnerImage, PublicProfile } from "@/lib/types/domain"

type ServerSupabase = Awaited<ReturnType<typeof createClient>>

type FeedRpcRow = Database["public"]["Functions"]["search_public_images"]["Returns"][number]
type PreviewRow = Pick<ImageRecord, "storage_path" | "thumbnail_path">

const DEFAULT_PAGE_SIZE = 24
const MAX_PAGE_SIZE = 48

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * Adds a signed URL to each row. Public reads use the derivative when one
 * exists; the original is owner-only, so an anonymous feed can never sign it.
 * `createSignedUrls` reports missing objects per entry rather than failing the
 * whole batch, so a single broken row still lets the rest of the gallery render.
 */
async function withSignedUrls<T extends PreviewRow>(
  supabase: ServerSupabase,
  rows: T[],
  expiresIn: number,
): Promise<Array<T & { signedUrl: string | null }>> {
  if (rows.length === 0) return []

  const paths = rows.map((row) => row.thumbnail_path ?? row.storage_path)
  const { data, error } = await supabase.storage.from("media").createSignedUrls(paths, expiresIn)

  if (error) {
    console.error("[images] batch signed URL creation failed", { error: error.message })
    return rows.map((row) => ({ ...row, signedUrl: null }))
  }

  const signedByPath = new Map<string, string | null>()
  for (const entry of data ?? []) {
    if (entry.path) signedByPath.set(entry.path, entry.signedUrl ?? null)
  }

  return rows.map((row, index) => ({ ...row, signedUrl: signedByPath.get(paths[index]) ?? null }))
}

export type GalleryImages = {
  publicImages: OwnerImage[]
  privateImages: OwnerImage[]
}

/**
 * Loads the images visible to the caller for one owner. RLS is the filter:
 * visitors receive only public rows, while the owner receives public and
 * private rows. Private previews use a shorter-lived signed URL.
 */
export async function getGalleryImages(ownerId: string): Promise<GalleryImages> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("images")
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[images] could not load gallery images", { ownerId, error: error.message })
    throw new Error("Could not load images.")
  }

  const rows = data ?? []
  const publicRows = rows.filter((row) => row.visibility === "public")
  const privateRows = rows.filter((row) => row.visibility === "private")

  const [publicImages, privateImages] = await Promise.all([
    withSignedUrls(supabase, publicRows, PUBLIC_SIGNED_URL_TTL_SECONDS),
    withSignedUrls(supabase, privateRows, PRIVATE_SIGNED_URL_TTL_SECONDS),
  ])

  return { publicImages, privateImages }
}

export type PublicFeedOptions = {
  search?: string
  category?: string
  /** 1-based page number. */
  page?: number
  pageSize?: number
}

export type PublicFeedResult = {
  images: FeedImage[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

function toFeedImage(row: FeedRpcRow): FeedImage | null {
  if (!row.owner_username) return null

  const owner: PublicProfile = {
    id: row.owner_id,
    username: row.owner_username,
    full_name: row.owner_full_name ?? null,
    bio: row.owner_bio ?? null,
    avatar_path: row.owner_avatar_path ?? null,
  }

  return {
    id: row.id,
    owner_id: row.owner_id,
    title: row.title,
    description: row.description,
    storage_path: row.storage_path,
    thumbnail_path: row.thumbnail_path,
    mime_type: row.mime_type,
    size_bytes: row.size_bytes,
    width: row.width,
    height: row.height,
    visibility: row.visibility,
    category: row.category,
    tags: row.tags ?? [],
    created_at: row.created_at,
    updated_at: row.updated_at,
    owner,
    signedUrl: null,
  }
}

/**
 * Public home feed. The `search_public_images` RPC filters on visibility, does
 * case-insensitive search across title/description/tags/owner, applies the
 * category filter, and returns the total row count for pagination in one round
 * trip. RLS still runs inside the function (it is security-invoker).
 */
export async function getPublicFeed(options: PublicFeedOptions = {}): Promise<PublicFeedResult> {
  const supabase = await createClient()
  const search = (options.search ?? "").trim().slice(0, 100)
  const category = (options.category ?? "").trim().slice(0, 40)
  const pageSize = clamp(Math.floor(options.pageSize ?? DEFAULT_PAGE_SIZE), 1, MAX_PAGE_SIZE)
  const page = Math.max(1, Math.floor(options.page ?? 1))
  const offset = (page - 1) * pageSize

  const { data, error } = await supabase.rpc("search_public_images", {
    p_search: search,
    p_category: category,
    p_limit: pageSize,
    p_offset: offset,
  })

  if (error) {
    console.error("[images] could not load the public feed", { error: error.message })
    throw new Error("Could not load the gallery.")
  }

  const rows = (data ?? []) as FeedRpcRow[]
  let total = rows.length > 0 ? Number(rows[0].total_count) : 0

  // An out-of-range page returns no rows, so probe the first page for its count.
  if (rows.length === 0 && page > 1) {
    const { data: probe, error: probeError } = await supabase.rpc("search_public_images", {
      p_search: search,
      p_category: category,
      p_limit: 1,
      p_offset: 0,
    })

    if (probeError) {
      console.error("[images] could not read the public feed total", { error: probeError.message })
    } else if (probe && probe.length > 0) {
      total = Number(probe[0].total_count)
    }
  }

  const mapped = rows.map(toFeedImage).filter((image): image is FeedImage => image !== null)
  const images = await withSignedUrls(supabase, mapped, PUBLIC_SIGNED_URL_TTL_SECONDS)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return { images, total, page, pageSize, totalPages }
}
