/**
 * Browser-side preview generation.
 *
 * Public galleries render this derivative instead of the original file. Canvas
 * re-encoding drops EXIF/GPS metadata, and the server keeps the original
 * owner-only, so location data never reaches anonymous visitors.
 *
 * This module uses DOM APIs and must only be imported from client components.
 */

import type { ThumbnailMime } from "@/lib/storage/paths"

export const THUMBNAIL_MAX_DIMENSION = 1600
export const THUMBNAIL_QUALITY = 0.85

export type PreparedImage = {
  width: number
  height: number
  thumbnail: Blob
  thumbnailMime: ThumbnailMime
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, THUMBNAIL_QUALITY)
  })
}

/**
 * Decodes the file once, records its display dimensions, and encodes a bounded
 * WebP (or JPEG fallback) preview. Throws when the browser cannot decode or
 * encode the image; the uploader surfaces that as a per-file error.
 */
export async function prepareImageForUpload(file: File): Promise<PreparedImage> {
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") {
    throw new Error("This browser cannot prepare image previews.")
  }

  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" })

  try {
    const longestSide = Math.max(bitmap.width, bitmap.height)
    const scale = longestSide > THUMBNAIL_MAX_DIMENSION ? THUMBNAIL_MAX_DIMENSION / longestSide : 1
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height

    const context = canvas.getContext("2d")
    if (!context) throw new Error("This browser cannot prepare image previews.")

    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = "high"
    context.drawImage(bitmap, 0, 0, width, height)

    const webp = await canvasToBlob(canvas, "image/webp")
    if (webp && webp.type === "image/webp") {
      return { width: bitmap.width, height: bitmap.height, thumbnail: webp, thumbnailMime: "image/webp" }
    }

    // Older browsers may fall back to PNG for an unsupported WebP request.
    const jpeg = await canvasToBlob(canvas, "image/jpeg")
    if (jpeg && jpeg.type === "image/jpeg") {
      return { width: bitmap.width, height: bitmap.height, thumbnail: jpeg, thumbnailMime: "image/jpeg" }
    }

    throw new Error("This browser cannot encode an image preview.")
  } finally {
    bitmap.close()
  }
}
