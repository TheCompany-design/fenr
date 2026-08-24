import { describe, expect, test } from "bun:test"

import { safeRedirectPath } from "./redirect"

describe("safeRedirectPath", () => {
  test("allows relative in-app paths", () => {
    expect(safeRedirectPath("/dashboard")).toBe("/dashboard")
    expect(safeRedirectPath("/")).toBe("/")
  })

  test("falls back on absolute and protocol-relative URLs (open-redirect guard)", () => {
    for (const evil of [
      "https://evil.example.com",
      "//evil.example.com",
      "javascript:alert(1)",
      "/\\evil.example.com",
      "",
      undefined,
      null,
      42,
    ]) {
      expect(safeRedirectPath(evil)).toBe("/")
    }
  })
})
