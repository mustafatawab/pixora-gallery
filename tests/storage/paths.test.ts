import { describe, expect, it } from "vitest"
import {
  buildImagePath,
  buildThumbnailPath,
  extensionForImageMime,
  formatBytes,
  IMAGE_MIME_TYPES,
  isAllowedImageMime,
  isAllowedThumbnailMime,
  isImagePathForOwner,
  isThumbnailPathForOwner,
  isUuid,
  parseImagePath,
  parseThumbnailPath,
  THUMBNAIL_MIME_TYPES,
} from "../../lib/storage/paths"

const owner = "11111111-1111-4111-8111-111111111111"
const image = "aaaaaaaa-2222-4222-8222-222222222222"

describe("storage paths", () => {
  it("maps every allowed MIME type to an extension", () => {
    expect(IMAGE_MIME_TYPES.map((mime) => extensionForImageMime(mime))).toEqual([
      "jpg",
      "png",
      "webp",
      "avif",
    ])
  })

  it("rejects unsupported MIME types", () => {
    expect(isAllowedImageMime("image/gif")).toBe(false)
    expect(isAllowedImageMime("image/svg+xml")).toBe(false)
    expect(extensionForImageMime("image/gif")).toBeNull()
    expect(() => buildImagePath(owner, image, "image/gif")).toThrow()
  })

  it("builds the canonical owner-scoped path", () => {
    expect(buildImagePath(owner, image, "image/jpeg")).toBe(`${owner}/${image}.jpg`)
    expect(buildImagePath(owner, image, "image/avif")).toBe(`${owner}/${image}.avif`)
  })

  it("refuses invalid ids instead of producing an unsafe path", () => {
    expect(() => buildImagePath("../etc", image, "image/jpeg")).toThrow()
    expect(() => buildImagePath(owner, "not-a-uuid", "image/jpeg")).toThrow()
    expect(isUuid(owner)).toBe(true)
    expect(isUuid("../../etc/passwd")).toBe(false)
  })

  it("parses and verifies owner paths", () => {
    const path = buildImagePath(owner, image, "image/png")
    expect(parseImagePath(path)).toEqual({ ownerId: owner, imageId: image, extension: "png" })
    expect(isImagePathForOwner(owner, path)).toBe(true)
    expect(isImagePathForOwner("22222222-2222-4222-8222-222222222222", path)).toBe(false)
    expect(parseImagePath(`${owner}/not-a-uuid.jpg`)).toBeNull()
    expect(parseImagePath(`${owner}/../../secret.jpg`)).toBeNull()
  })

  it("builds and parses metadata-free thumbnail paths", () => {
    expect(THUMBNAIL_MIME_TYPES).toEqual(["image/webp", "image/jpeg"])
    expect(isAllowedThumbnailMime("image/webp")).toBe(true)
    expect(isAllowedThumbnailMime("image/png")).toBe(false)

    const webp = buildThumbnailPath(owner, image, "image/webp")
    const jpeg = buildThumbnailPath(owner, image, "image/jpeg")

    expect(webp).toBe(`${owner}/${image}.thumb.webp`)
    expect(jpeg).toBe(`${owner}/${image}.thumb.jpg`)
    expect(parseThumbnailPath(webp)).toEqual({ ownerId: owner, imageId: image, extension: "webp" })
    expect(isThumbnailPathForOwner(owner, webp)).toBe(true)
    expect(isThumbnailPathForOwner("22222222-2222-4222-8222-222222222222", webp)).toBe(false)

    // Thumbnail paths must not be mistaken for originals.
    expect(parseImagePath(webp)).toBeNull()
    expect(parseThumbnailPath(`${owner}/${image}.jpg`)).toBeNull()
    expect(parseThumbnailPath(`${owner}/../../secret.thumb.webp`)).toBeNull()
    expect(() => buildThumbnailPath(owner, image, "image/png")).toThrow()
  })

  it("formats byte counts for the UI", () => {
    expect(formatBytes(512)).toBe("512 B")
    expect(formatBytes(2048)).toBe("2.0 KB")
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB")
    expect(formatBytes(Number.NaN)).toBe("—")
  })
})
