import { describe, expect, it } from "bun:test"
import {
  acceptInvitationSchema,
  cancelInvitationSchema,
  createOrganizationSchema,
  inviteMemberSchema,
  isReservedSlug,
  isValidSlugFormat,
  normalizeSlug,
  organizationNameSchema,
  organizationRoleSchema,
  removeMemberSchema,
  setActiveOrganizationSchema,
  slugSchema,
  updateMemberRoleSchema,
  updateOrganizationSchema,
} from "./organizations"

describe("organization domain schemas", () => {
  describe("slug utilities", () => {
    it("normalizes raw strings into lowercased hyphenated slugs", () => {
      expect(normalizeSlug("Acme Corporation")).toBe("acme-corporation")
      expect(normalizeSlug("  Special &! Characters  ")).toBe(
        "special-characters",
      )
      expect(normalizeSlug("---already---hyphenated---")).toBe(
        "already-hyphenated",
      )
      expect(normalizeSlug("")).toBe("")
    })

    it("identifies reserved slugs accurately", () => {
      expect(isReservedSlug("admin")).toBe(true)
      expect(isReservedSlug("auth")).toBe(true)
      expect(isReservedSlug("dashboard")).toBe(true)
      expect(isReservedSlug("onboarding")).toBe(true)
      expect(isReservedSlug("settings")).toBe(true)
      expect(isReservedSlug("my-workspace")).toBe(false)
    })

    it("validates slug format constraints", () => {
      expect(isValidSlugFormat("acme")).toBe(true)
      expect(isValidSlugFormat("acme-team")).toBe(true)
      expect(isValidSlugFormat("ab")).toBe(false) // too short
      expect(isValidSlugFormat("a".repeat(49))).toBe(false) // too long
      expect(isValidSlugFormat("-leading-hyphen")).toBe(false)
      expect(isValidSlugFormat("trailing-hyphen-")).toBe(false)
      expect(isValidSlugFormat("double--hyphen")).toBe(false)
      expect(isValidSlugFormat("has spaces")).toBe(false)
    })
  })

  describe("slugSchema", () => {
    it("transforms and validates a valid slug", () => {
      const result = slugSchema.safeParse(" Acme Team ")
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe("acme-team")
      }
    })

    it("rejects reserved slugs", () => {
      const result = slugSchema.safeParse("settings")
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("reserved")
      }
    })

    it("rejects too short slugs", () => {
      const result = slugSchema.safeParse("a")
      expect(result.success).toBe(false)
    })
  })

  describe("organizationNameSchema", () => {
    it("accepts valid names and trims whitespace", () => {
      const result = organizationNameSchema.safeParse("  Fenr Studio  ")
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe("Fenr Studio")
      }
    })

    it("rejects names shorter than 2 characters", () => {
      expect(organizationNameSchema.safeParse("a").success).toBe(false)
      expect(organizationNameSchema.safeParse("   ").success).toBe(false)
    })
  })

  describe("createOrganizationSchema", () => {
    it("accepts valid organization input", () => {
      const result = createOrganizationSchema.safeParse({
        name: "Acme Corp",
        slug: "acme-corp",
        logo: "https://example.com/logo.png",
      })
      expect(result.success).toBe(true)
    })

    it("accepts nullable logo", () => {
      const result = createOrganizationSchema.safeParse({
        name: "Acme Corp",
        slug: "acme-corp",
        logo: null,
      })
      expect(result.success).toBe(true)
    })

    it("rejects invalid logo URL", () => {
      const result = createOrganizationSchema.safeParse({
        name: "Acme Corp",
        slug: "acme-corp",
        logo: "not-a-url",
      })
      expect(result.success).toBe(false)
    })
  })

  describe("organizationRoleSchema", () => {
    it("accepts valid roles", () => {
      expect(organizationRoleSchema.parse("owner")).toBe("owner")
      expect(organizationRoleSchema.parse("admin")).toBe("admin")
      expect(organizationRoleSchema.parse("member")).toBe("member")
    })

    it("rejects invalid roles", () => {
      expect(organizationRoleSchema.safeParse("superadmin").success).toBe(false)
    })
  })

  describe("inviteMemberSchema", () => {
    const validOrgId = "123e4567-e89b-12d3-a456-426614174000"

    it("validates and lowercases email", () => {
      const result = inviteMemberSchema.safeParse({
        organizationId: validOrgId,
        email: " User@Example.COM ",
        role: "admin",
        note: "Welcome!",
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.email).toBe("user@example.com")
        expect(result.data.role).toBe("admin")
        expect(result.data.note).toBe("Welcome!")
      }
    })

    it("rejects invalid email address", () => {
      const result = inviteMemberSchema.safeParse({
        organizationId: validOrgId,
        email: "not-an-email",
      })
      expect(result.success).toBe(false)
    })
  })

  describe("uuid schemas", () => {
    const validUuid = "123e4567-e89b-12d3-a456-426614174000"

    it("validates setActiveOrganizationSchema", () => {
      expect(
        setActiveOrganizationSchema.safeParse({ organizationId: validUuid })
          .success,
      ).toBe(true)
      expect(
        setActiveOrganizationSchema.safeParse({ organizationId: "invalid" })
          .success,
      ).toBe(false)
    })

    it("validates cancelInvitationSchema", () => {
      expect(
        cancelInvitationSchema.safeParse({
          organizationId: validUuid,
          invitationId: validUuid,
        }).success,
      ).toBe(true)
    })

    it("validates updateMemberRoleSchema", () => {
      expect(
        updateMemberRoleSchema.safeParse({
          organizationId: validUuid,
          memberId: validUuid,
          role: "admin",
        }).success,
      ).toBe(true)
    })

    it("validates removeMemberSchema", () => {
      expect(
        removeMemberSchema.safeParse({
          organizationId: validUuid,
          memberId: validUuid,
        }).success,
      ).toBe(true)
    })

    it("validates acceptInvitationSchema", () => {
      expect(
        acceptInvitationSchema.safeParse({ invitationId: validUuid }).success,
      ).toBe(true)
      expect(
        acceptInvitationSchema.safeParse({ invitationId: "abc" }).success,
      ).toBe(false)
    })

    it("validates updateOrganizationSchema", () => {
      expect(
        updateOrganizationSchema.safeParse({
          organizationId: validUuid,
          name: "Updated Org",
          slug: "updated-org",
          logo: null,
        }).success,
      ).toBe(true)
    })
  })
})
