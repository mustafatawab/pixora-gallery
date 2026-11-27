"use server"

import { revalidatePath } from "next/cache"
import type { ZodError } from "zod"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUser } from "@/lib/auth/current-user"
import { consumeUploadQuota } from "@/lib/rate-limit/upload"
import { buildImagePath, buildThumbnailPath, MAX_IMAGE_BYTES, MAX_THUMBNAIL_BYTES } from "@/lib/storage/paths"
import { createImageSchema, deleteImageSchema, updateImageVisibilitySchema } from "@/lib/validation/image"
import type { ImageActionResult } from "@/lib/types/domain"

type ServerSupabase = Awaited<ReturnType<typeof createClient>>

/** Refresh every surface that can show an owner's images. */
async function revalidateOwnerSurfaces(supabase: ServerSupabase, ownerId: string) {
  revalidatePath("/")
  revalidatePath("/profile")

  const { data } = await supabase.from("profiles").select("username").eq("id", ownerId).maybeSingle()
  if (data?.username) revalidatePath(`/u/${data.username}`)
}

function fieldErrorsFrom(error: ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path[0]
    if (typeof key === "string" && !fieldErrors[key]) fieldErrors[key] = issue.message
  }
  return fieldErrors
}

type StoredObject = {
  size: number | null
  mimeType: string | null
}

/**
 * Looks up the object in the owner's Storage folder. Using `list` (rather than
 * trusting the client) proves the file exists and gives us its stored size/MIME
 * without downloading it. RLS scopes the listing to the signed-in user.
 */
async function findStoredObject(
  supabase: ServerSupabase,
  ownerId: string,
  fileName: string,
): Promise<{ object: StoredObject | null; error: string | null }> {
  const { data, error } = await supabase.storage.from("media").list(ownerId, {
    limit: 100,
    search: fileName,
  })

  if (error) return { object: null, error: error.message }

  const entry = data?.find((item) => item.id !== null && item.name === fileName)
  if (!entry) return { object: null, error: null }

  return {
    object: {
      size: typeof entry.metadata?.size === "number" ? entry.metadata.size : null,
      mimeType: typeof entry.metadata?.mimetype === "string" ? entry.metadata.mimetype : null,
    },
    error: null,
  }
}

async function removeUploadedObjects(supabase: ServerSupabase, paths: string[]) {
  const removable = paths.filter(Boolean)
  if (removable.length === 0) return

  const { error } = await supabase.storage.from("media").remove(removable)
  if (error) {
    console.error("[images] failed to remove upload objects after metadata failure", {
      paths: removable,
      error: error.message,
    })
  }
}

export async function createImageAction(input: unknown): Promise<ImageActionResult> {
  const parsed = createImageSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: "Check the image details and try again.", fieldErrors: fieldErrorsFrom(parsed.error) }
  }

  const user = await getCurrentUser()
  if (!user) {
    return { ok: false, error: "You need to sign in before uploading images." }
  }

  const { id, mimeType, thumbnailMimeType, title, description, category, tags, visibility, width, height } =
    parsed.data
  const supabase = await createClient()

  // Retries (for example after a lost response) are idempotent and do not
  // consume quota.
  const { data: existing } = await supabase
    .from("images")
    .select("id")
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle()

  if (existing) return { ok: true, imageId: existing.id }

  const quota = await consumeUploadQuota(supabase)
  if (quota && !quota.allowed) {
    return {
      ok: false,
      error: "You've reached the upload limit (30 images per hour). Please try again later.",
    }
  }

  const path = buildImagePath(user.id, id, mimeType)
  const thumbnailPath = buildThumbnailPath(user.id, id, thumbnailMimeType)
  const fileName = path.slice(user.id.length + 1)
  const thumbnailFileName = thumbnailPath.slice(user.id.length + 1)

  const [{ object, error: lookupError }, { object: thumbnail, error: thumbnailLookupError }] = await Promise.all([
    findStoredObject(supabase, user.id, fileName),
    findStoredObject(supabase, user.id, thumbnailFileName),
  ])

  if (lookupError || thumbnailLookupError) {
    console.error("[images] could not verify the uploaded objects", {
      path,
      thumbnailPath,
      error: lookupError ?? thumbnailLookupError,
    })
    return { ok: false, error: "We couldn't verify the uploaded file. Please try again." }
  }

  if (!object || !thumbnail) {
    return { ok: false, error: "The uploaded file wasn't found. Please upload it again." }
  }

  if (object.size !== null && object.size > MAX_IMAGE_BYTES) {
    await removeUploadedObjects(supabase, [path, thumbnailPath])
    return { ok: false, error: "Images must be 50 MB or smaller." }
  }

  if (thumbnail.size !== null && thumbnail.size > MAX_THUMBNAIL_BYTES) {
    await removeUploadedObjects(supabase, [path, thumbnailPath])
    return { ok: false, error: "The generated preview is too large. Please try another image." }
  }

  if (object.mimeType && object.mimeType !== mimeType) {
    await removeUploadedObjects(supabase, [path, thumbnailPath])
    return { ok: false, error: "The uploaded file type doesn't match. Please try again." }
  }

  if (thumbnail.mimeType && thumbnail.mimeType !== thumbnailMimeType) {
    await removeUploadedObjects(supabase, [path, thumbnailPath])
    return { ok: false, error: "The generated preview type doesn't match. Please try again." }
  }

  const normalizedTags = Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean)))

  const { error: insertError } = await supabase.from("images").insert({
    id,
    owner_id: user.id,
    title,
    description: description?.trim() ? description.trim() : null,
    storage_path: path,
    thumbnail_path: thumbnailPath,
    mime_type: object.mimeType ?? mimeType,
    size_bytes: object.size,
    width: width ?? null,
    height: height ?? null,
    visibility,
    category: category?.trim() ? category.trim() : null,
    tags: normalizedTags,
  })

  if (insertError) {
    // A concurrent retry can win the insert. Treat it as success.
    if (insertError.code === "23505") {
      const { data: raced } = await supabase
        .from("images")
        .select("id")
        .eq("id", id)
        .eq("owner_id", user.id)
        .maybeSingle()
      if (raced) return { ok: true, imageId: raced.id }
    }

    console.error("[images] metadata insert failed", { path, code: insertError.code, error: insertError.message })
    await removeUploadedObjects(supabase, [path, thumbnailPath])
    return { ok: false, error: "Could not save the image. Please try again." }
  }

  await revalidateOwnerSurfaces(supabase, user.id)

  return { ok: true, imageId: id }
}

export async function deleteImageAction(input: unknown): Promise<ImageActionResult> {
  const parsed = deleteImageSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: "Invalid image.", fieldErrors: fieldErrorsFrom(parsed.error) }
  }

  const user = await getCurrentUser()
  if (!user) {
    return { ok: false, error: "You need to sign in to delete images." }
  }

  const supabase = await createClient()

  // Delete the row first: even if Storage cleanup fails, the object immediately
  // stops being listed or signable. The cleanup job removes the orphan later.
  const { data, error } = await supabase
    .from("images")
    .delete()
    .eq("id", parsed.data.id)
    .eq("owner_id", user.id)
    .select("storage_path, thumbnail_path")
    .maybeSingle()

  if (error) {
    console.error("[images] delete failed", { id: parsed.data.id, code: error.code, error: error.message })
    return { ok: false, error: "Could not delete the image. Please try again." }
  }

  if (!data) {
    return { ok: false, error: "Image not found, or you don't have permission to delete it." }
  }

  const pathsToRemove = [data.storage_path, data.thumbnail_path].filter((path): path is string => Boolean(path))
  const { error: removeError } = await supabase.storage.from("media").remove(pathsToRemove)

  await revalidateOwnerSurfaces(supabase, user.id)

  if (removeError) {
    console.error("[images] deleted the row but could not remove the stored objects", {
      paths: pathsToRemove,
      error: removeError.message,
    })
    return {
      ok: true,
      warning: "The image was deleted, but its stored file could not be removed. Cleanup will retry automatically.",
    }
  }

  return { ok: true }
}

/**
 * Toggles an image between public and private. The row stays put and the
 * Storage object never moves, so the change is atomic from the browser's
 * point of view. Ownership is checked both in the query and by RLS.
 */
export async function updateImageVisibilityAction(input: unknown): Promise<ImageActionResult> {
  const parsed = updateImageVisibilitySchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: "Invalid image.", fieldErrors: fieldErrorsFrom(parsed.error) }
  }

  const user = await getCurrentUser()
  if (!user) {
    return { ok: false, error: "You need to sign in to change image visibility." }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("images")
    .update({ visibility: parsed.data.visibility })
    .eq("id", parsed.data.id)
    .eq("owner_id", user.id)
    .select("id, visibility")
    .maybeSingle()

  if (error) {
    console.error("[images] visibility update failed", {
      id: parsed.data.id,
      code: error.code,
      error: error.message,
    })
    return { ok: false, error: "Could not update visibility. Please try again." }
  }

  if (!data) {
    return { ok: false, error: "Image not found, or you don't have permission to change it." }
  }

  await revalidateOwnerSurfaces(supabase, user.id)

  return { ok: true, imageId: data.id, visibility: data.visibility }
}
