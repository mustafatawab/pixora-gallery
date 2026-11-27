import { describe, expect, it } from "vitest"
import { safeNextPath } from "../../lib/auth/redirects"

describe("safeNextPath", () => {
  it("defaults to the home page", () => {
    expect(safeNextPath(undefined)).toBe("/")
    expect(safeNextPath(null)).toBe("/")
    expect(safeNextPath("")).toBe("/")
  })

  it("keeps same-origin relative paths", () => {
    expect(safeNextPath("/upload")).toBe("/upload")
    expect(safeNextPath("/profile?tab=settings")).toBe("/profile?tab=settings")
    expect(safeNextPath("/")).toBe("/")
  })

  it("rejects absolute URLs and protocol-relative URLs", () => {
    expect(safeNextPath("https://evil.com")).toBe("/")
    expect(safeNextPath("http://evil.com/steal")).toBe("/")
    expect(safeNextPath("//evil.com")).toBe("/")
    expect(safeNextPath("///evil.com")).toBe("/")
  })

  it("rejects script and data URLs", () => {
    expect(safeNextPath("javascript:alert(1)")).toBe("/")
    expect(safeNextPath("data:text/html,<script>alert(1)</script>")).toBe("/")
  })

  it("rejects auth pages to avoid redirect loops", () => {
    expect(safeNextPath("/login")).toBe("/")
    expect(safeNextPath("/register")).toBe("/")
    expect(safeNextPath("/login?next=/upload")).toBe("/")
  })
})
