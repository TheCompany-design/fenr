import { describe, expect, it } from "bun:test"
import {
  authCheckEmailSearchSchema,
  authLayoutSearchSchema,
  authSignInSearchSchema,
  authSignUpSearchSchema,
  chooseOrganizationSearchSchema,
  invitationAcceptSearchSchema,
  onboardingSearchSchema,
} from "./search"

describe("route search schemas", () => {
  describe("authLayoutSearchSchema", () => {
    it("accepts redirect string and passes through extra params", () => {
      const parsed = authLayoutSearchSchema.parse({
        redirect: "/dashboard",
        extra: "token",
      })
      expect(parsed.redirect).toBe("/dashboard")
      expect((parsed as Record<string, unknown>).extra).toBe("token")
    })

    it("accepts empty object", () => {
      const parsed = authLayoutSearchSchema.parse({})
      expect(parsed.redirect).toBeUndefined()
    })
  })

  describe("authSignInSearchSchema", () => {
    it("parses redirect and error", () => {
      const parsed = authSignInSearchSchema.parse({
        redirect: "/settings",
        error: "session_expired",
      })
      expect(parsed.redirect).toBe("/settings")
      expect(parsed.error).toBe("session_expired")
    })
  })

  describe("authSignUpSearchSchema", () => {
    it("parses redirect param", () => {
      const parsed = authSignUpSearchSchema.parse({ redirect: "/onboarding" })
      expect(parsed.redirect).toBe("/onboarding")
    })
  })

  describe("authCheckEmailSearchSchema", () => {
    it("defaults email to empty string if missing", () => {
      const parsed = authCheckEmailSearchSchema.parse({})
      expect(parsed.email).toBe("")
    })

    it("parses email, redirect, and error", () => {
      const parsed = authCheckEmailSearchSchema.parse({
        email: "alice@example.com",
        redirect: "/app",
        error: "invalid_token",
      })
      expect(parsed.email).toBe("alice@example.com")
      expect(parsed.redirect).toBe("/app")
      expect(parsed.error).toBe("invalid_token")
    })
  })

  describe("chooseOrganizationSearchSchema", () => {
    it("parses redirect option", () => {
      const parsed = chooseOrganizationSearchSchema.parse({ redirect: "/app" })
      expect(parsed.redirect).toBe("/app")
    })
  })

  describe("invitationAcceptSearchSchema", () => {
    it("parses id string", () => {
      const parsed = invitationAcceptSearchSchema.parse({ id: "inv-123" })
      expect(parsed.id).toBe("inv-123")
    })

    it("catches non-string or undefined id safely", () => {
      const parsed = invitationAcceptSearchSchema.parse({ id: 12345 })
      expect(parsed.id).toBeUndefined()
    })
  })

  describe("onboardingSearchSchema", () => {
    it("defaults step to 'naming' when missing or invalid", () => {
      expect(onboardingSearchSchema.parse({}).step).toBe("naming")
      expect(onboardingSearchSchema.parse({ step: "unknown" }).step).toBe(
        "naming",
      )
    })

    it("accepts valid steps", () => {
      expect(onboardingSearchSchema.parse({ step: "invites" }).step).toBe(
        "invites",
      )
      expect(onboardingSearchSchema.parse({ step: "welcome" }).step).toBe(
        "welcome",
      )
    })

    it("validates orgId as uuid and catches invalid uuid", () => {
      const validUuid = "123e4567-e89b-12d3-a456-426614174000"
      expect(onboardingSearchSchema.parse({ orgId: validUuid }).orgId).toBe(
        validUuid,
      )
      expect(
        onboardingSearchSchema.parse({ orgId: "not-a-uuid" }).orgId,
      ).toBeUndefined()
    })
  })
})
