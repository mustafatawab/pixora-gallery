import { describe, expect, it } from "vitest"
import { createImageSchema, updateImageVisibilitySchema } from "../../lib/validation/image"

const base = {
  id: "aaaaaaaa-2222-4222-8222-222222222222",
  mimeType: "image/jpeg",
  thumbnailMimeType: "image/webp",
  title: "  Mountain sunrise  ",
}

describe("createImageSchema", () => {
  it("defaults visibility to private and tags to an empty list", () => {
    const parsed = createImageSchema.parse(base)
    expect(parsed.visibility).toBe("private")
    expect(parsed.tags).toEqual([])
    expect(parsed.title).toBe("Mountain sunrise")
  })

  it("accepts the full metadata set", () => {
    const parsed = createImageSchema.parse({
      ...base,
      description: "Golden hour",
      category: "nature",
      tags: ["nature", "sunrise"],
      visibility: "public",
      width: 4000,
      height: 6000,
    })

    expect(parsed.visibility).toBe("public")
    expect(parsed.width).toBe(4000)
  })

  it("rejects unsupported file types", () => {
    expect(createImageSchema.safeParse({ ...base, mimeType: "image/gif" }).success).toBe(false)
    expect(createImageSchema.safeParse({ ...base, mimeType: "text/html" }).success).toBe(false)
  })

  it("requires a browser-generated preview type", () => {
    expect(createImageSchema.safeParse({ ...base, thumbnailMimeType: undefined }).success).toBe(false)
    expect(createImageSchema.safeParse({ ...base, thumbnailMimeType: "image/png" }).success).toBe(false)
    expect(createImageSchema.safeParse({ ...base, thumbnailMimeType: "image/jpeg" }).success).toBe(true)
  })

  it("rejects invalid ids, empty titles, and too many tags", () => {
    expect(createImageSchema.safeParse({ ...base, id: "not-a-uuid" }).success).toBe(false)
    expect(createImageSchema.safeParse({ ...base, title: "   " }).success).toBe(false)
    expect(
      createImageSchema.safeParse({
        ...base,
        tags: Array.from({ length: 11 }, (_, index) => `tag-${index}`),
      }).success,
    ).toBe(false)
  })

  it("rejects oversized tag and description values", () => {
    expect(createImageSchema.safeParse({ ...base, tags: ["x".repeat(31)] }).success).toBe(false)
    expect(createImageSchema.safeParse({ ...base, description: "x".repeat(2001) }).success).toBe(false)
    expect(createImageSchema.safeParse({ ...base, width: -1 }).success).toBe(false)
  })
})

describe("updateImageVisibilitySchema", () => {
  it("accepts both visibility values for a valid image id", () => {
    expect(updateImageVisibilitySchema.safeParse({ id: base.id, visibility: "public" }).success).toBe(true)
    expect(updateImageVisibilitySchema.safeParse({ id: base.id, visibility: "private" }).success).toBe(true)
  })

  it("rejects unknown visibility values and malformed ids", () => {
    expect(updateImageVisibilitySchema.safeParse({ id: base.id, visibility: "draft" }).success).toBe(false)
    expect(updateImageVisibilitySchema.safeParse({ id: "not-a-uuid", visibility: "public" }).success).toBe(false)
    expect(updateImageVisibilitySchema.safeParse({ visibility: "public" }).success).toBe(false)
  })
})
