/**
 * Shared Storage path + upload constraints.
 *
 * This module is imported by both the browser uploader and server actions, so it
 * must stay free of Node-only or server-only imports. The server derives the
 * same path from the session user id and never trusts a client-supplied path.
 */

export const MAX_IMAGE_BYTES = 50 * 1024 * 1024

/** A canvas-encoded preview is small; this only guards against abuse. */
export const MAX_THUMBNAIL_BYTES = 5 * 1024 * 1024

export const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const

export type AllowedImageMime = (typeof IMAGE_MIME_TYPES)[number]

export const THUMBNAIL_MIME_TYPES = ["image/webp", "image/jpeg"] as const

export type ThumbnailMime = (typeof THUMBNAIL_MIME_TYPES)[number]

const THUMBNAIL_EXTENSIONS: Record<ThumbnailMime, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
}

const MIME_EXTENSIONS: Record<AllowedImageMime, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
}

const UUID_SOURCE = "[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}"
const UUID_PATTERN = new RegExp(`^${UUID_SOURCE}$`, "i")
const IMAGE_PATH_PATTERN = new RegExp(`^(${UUID_SOURCE})/(${UUID_SOURCE})\\.([a-z0-9]{3,4})$`, "i")
const THUMBNAIL_PATH_PATTERN = new RegExp(`^(${UUID_SOURCE})/(${UUID_SOURCE})\\.thumb\\.(webp|jpg)$`, "i")

export function isAllowedImageMime(mimeType: string): mimeType is AllowedImageMime {
  return (IMAGE_MIME_TYPES as readonly string[]).includes(mimeType)
}

export function isAllowedThumbnailMime(mimeType: string): mimeType is ThumbnailMime {
  return (THUMBNAIL_MIME_TYPES as readonly string[]).includes(mimeType)
}

export function extensionForImageMime(mimeType: string): string | null {
  return isAllowedImageMime(mimeType) ? MIME_EXTENSIONS[mimeType] : null
}

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value)
}

/**
 * The canonical object path for an upload: `{owner_id}/{image_id}.{ext}`.
 * Throws for anything that could escape the owner folder.
 */
export function buildImagePath(ownerId: string, imageId: string, mimeType: string): string {
  if (!isUuid(ownerId) || !isUuid(imageId)) {
    throw new Error("Invalid owner or image id")
  }

  const extension = extensionForImageMime(mimeType)
  if (!extension) {
    throw new Error("Unsupported image type")
  }

  return `${ownerId}/${imageId}.${extension}`
}

export function parseImagePath(path: string): { ownerId: string; imageId: string; extension: string } | null {
  const match = IMAGE_PATH_PATTERN.exec(path)
  if (!match) return null
  return { ownerId: match[1], imageId: match[2], extension: match[3].toLowerCase() }
}

export function isImagePathForOwner(ownerId: string, path: string): boolean {
  const parsed = parseImagePath(path)
  return parsed !== null && parsed.ownerId === ownerId
}

/**
 * The derivative path for an upload: `{owner_id}/{image_id}.thumb.{ext}`.
 * Canvas-encoded thumbnails carry no EXIF/GPS metadata, and Storage only allows
 * anonymous reads of these derivative objects.
 */
export function buildThumbnailPath(ownerId: string, imageId: string, mimeType: string): string {
  if (!isUuid(ownerId) || !isUuid(imageId)) {
    throw new Error("Invalid owner or image id")
  }

  if (!isAllowedThumbnailMime(mimeType)) {
    throw new Error("Unsupported thumbnail type")
  }

  return `${ownerId}/${imageId}.thumb.${THUMBNAIL_EXTENSIONS[mimeType]}`
}

export function parseThumbnailPath(path: string): { ownerId: string; imageId: string; extension: string } | null {
  const match = THUMBNAIL_PATH_PATTERN.exec(path)
  if (!match) return null
  return { ownerId: match[1], imageId: match[2], extension: match[3].toLowerCase() }
}

export function isThumbnailPathForOwner(ownerId: string, path: string): boolean {
  const parsed = parseThumbnailPath(path)
  return parsed !== null && parsed.ownerId === ownerId
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
