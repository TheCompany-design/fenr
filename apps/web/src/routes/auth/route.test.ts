import { describe, expect, it } from "bun:test"

import { getAuthTagline } from "./route"

describe("Auth Layout Route", () => {
  describe("getAuthTagline", () => {
    it("returns sign-up tagline for sign-up path", () => {
      expect(getAuthTagline("/auth/sign-up")).toBe(
        "Create your account and start with a clean, focused canvas.",
      )
    })

    it("returns check-email tagline for check-email path", () => {
      expect(getAuthTagline("/auth/check-email")).toBe(
        "A quiet workspace for focused work.",
      )
    })

    it("returns sign-in tagline for sign-in path or default", () => {
      expect(getAuthTagline("/auth/sign-in")).toBe(
        "A quiet workspace for focused work. Sign in to pick up where you left off.",
      )
      expect(getAuthTagline("/auth")).toBe(
        "A quiet workspace for focused work. Sign in to pick up where you left off.",
      )
    })
  })
})
