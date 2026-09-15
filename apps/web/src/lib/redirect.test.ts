import { describe, expect, test } from "bun:test"

import { safeAppRedirectPath, safeRedirectPath } from "./redirect"

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
      "/\\t/evil.example.com",
      "/\t/evil.example.com",
      "/\n/evil.example.com",
      "/\r/evil.example.com",
      "",
      undefined,
      null,
      42,
    ]) {
      expect(safeRedirectPath(evil)).toBe("/")
    }
  })
})

describe("safeAppRedirectPath", () => {
  test("allows valid app paths", () => {
    expect(safeAppRedirectPath("/documents/123")).toBe("/documents/123")
    expect(safeAppRedirectPath("/settings/profile")).toBe("/settings/profile")
  })

  test("rejects forbidden prefixes including query parameters, fragments, and dot segments", () => {
    expect(safeAppRedirectPath("/auth")).toBe("/")
    expect(safeAppRedirectPath("/auth/sign-in")).toBe("/")
    expect(safeAppRedirectPath("/auth?next=/dashboard")).toBe("/")
    expect(safeAppRedirectPath("/auth#callback")).toBe("/")
    expect(safeAppRedirectPath("/allowed/../auth")).toBe("/")
    expect(safeAppRedirectPath("/choose-organization")).toBe("/")
    expect(safeAppRedirectPath("/choose-organization#section")).toBe("/")
    expect(safeAppRedirectPath("/onboarding")).toBe("/")
    expect(safeAppRedirectPath("/onboarding/step")).toBe("/")
  })
})
