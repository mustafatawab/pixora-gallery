import { z } from "zod"
import { isAllowedImageMime, isAllowedThumbnailMime, MAX_IMAGE_BYTES } from "@/lib/storage/paths"

/**
 * Metadata accepted after a direct-to-Storage upload. The server derives the
 * object path, owner, and size itself; only user-editable fields are accepted.
 */
export const createImageSchema = z.object({
  id: z.string().uuid("Invalid image id"),
  mimeType: z.string().refine(isAllowedImageMime, "Unsupported image type"),
  title: z.string().trim().min(1, "Title is required").max(200, "Title must be 200 characters or fewer"),
  description: z.string().trim().max(2000, "Description must be 2000 characters or fewer").optional(),
  category: z.string().trim().max(40, "Category must be 40 characters or fewer").optional(),
  tags: z
    .array(z.string().trim().min(1, "Tags cannot be empty").max(30, "Tags must be 30 characters or fewer"))
    .max(10, "Use at most 10 tags")
    .default([]),
  visibility: z.enum(["public", "private"]).default("private"),
  width: z.number().int().positive().max(20000).optional().nullable(),
  height: z.number().int().positive().max(20000).optional().nullable(),
  // The browser generates a metadata-free preview before uploading. Requiring
  // it here means a public image can never fall back to the original file.
  thumbnailMimeType: z.string().refine(isAllowedThumbnailMime, "Unsupported preview type"),
})

export type CreateImageInput = z.input<typeof createImageSchema>

export const deleteImageSchema = z.object({
  id: z.string().uuid("Invalid image id"),
})

export const updateImageVisibilitySchema = z.object({
  id: z.string().uuid("Invalid image id"),
  visibility: z.enum(["public", "private"]),
})

export const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_BYTES
