import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { db, eq, schema } from "@workspace/database"

import {
  clearActiveOrganizationPreference,
  isValidUuid,
  resolveUserActiveOrganization,
  setActiveOrganizationPreference,
} from "./resolver"

describe("Active Organization Resolver", () => {
  let testUserId: string
  let testOrgId1: string
  let testOrgId2: string

  beforeEach(async () => {
    // Create test user
    const [user] = await db
      .insert(schema.user)
      .values({
        name: "Resolver Test User",
        email: `resolver-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
      })
      .returning()
    testUserId = user.id

    // Create test organizations
    const [org1] = await db
      .insert(schema.organization)
      .values({
        name: "Test Org 1",
        slug: `test-org-1-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      })
      .returning()
    testOrgId1 = org1.id

    const [org2] = await db
      .insert(schema.organization)
      .values({
        name: "Test Org 2",
        slug: `test-org-2-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      })
      .returning()
    testOrgId2 = org2.id
  })

  afterEach(async () => {
    if (testUserId) {
      await db.delete(schema.user).where(eq(schema.user.id, testUserId))
    }
    if (testOrgId1) {
      await db
        .delete(schema.organization)
        .where(eq(schema.organization.id, testOrgId1))
    }
    if (testOrgId2) {
      await db
        .delete(schema.organization)
        .where(eq(schema.organization.id, testOrgId2))
    }
  })

  describe("UUID Validation & Boundaries", () => {
    it("validates UUID format correctly", () => {
      expect(isValidUuid("0191ca7f-8e7c-7a91-9c12-3456789abcde")).toBe(true)
      expect(isValidUuid("invalid-uuid")).toBe(false)
      expect(isValidUuid("")).toBe(false)
      expect(isValidUuid(null)).toBe(false)
      expect(isValidUuid(undefined)).toBe(false)
      expect(isValidUuid(12345)).toBe(false)
    })

    it("returns no_organizations safely when userId is not a valid UUID without throwing Postgres errors", async () => {
      const res1 = await resolveUserActiveOrganization("not-a-uuid")
      expect(res1).toEqual({
        organizationId: null,
        status: "no_organizations",
        count: 0,
      })

      const res2 = await resolveUserActiveOrganization("")
      expect(res2).toEqual({
        organizationId: null,
        status: "no_organizations",
        count: 0,
      })
    })

    it("rejects non-UUID parameters in setActiveOrganizationPreference", async () => {
      await expect(
        setActiveOrganizationPreference("invalid", testOrgId1),
      ).rejects.toThrow(/UUID/)
      await expect(
        setActiveOrganizationPreference(testUserId, "invalid"),
      ).rejects.toThrow(/UUID/)
    })

    it("handles invalid UUID safely in clearActiveOrganizationPreference without throwing", async () => {
      await expect(
        clearActiveOrganizationPreference("not-a-uuid"),
      ).resolves.toBeUndefined()
    })
  })

  describe("Resolution Rules", () => {
    it("returns no_organizations when user belongs to 0 organizations", async () => {
      const result = await resolveUserActiveOrganization(testUserId)
      expect(result).toEqual({
        organizationId: null,
        status: "no_organizations",
        count: 0,
      })
    })

    it("auto-selects single organization and persists preference", async () => {
      // Add user as member of org1
      await db.insert(schema.member).values({
        userId: testUserId,
        organizationId: testOrgId1,
        role: "owner",
      })

      const result = await resolveUserActiveOrganization(testUserId)
      expect(result).toEqual({
        organizationId: testOrgId1,
        status: "single_membership",
      })

      // Verify preference was recorded in user_active_organization table
      const [pref] = await db
        .select()
        .from(schema.userActiveOrganization)
        .where(eq(schema.userActiveOrganization.userId, testUserId))
      expect(pref?.organizationId).toBe(testOrgId1)
    })

    it("returns multiple_organizations_no_preference when user has >1 orgs without preference", async () => {
      // Add user to both orgs
      await db.insert(schema.member).values([
        {
          userId: testUserId,
          organizationId: testOrgId1,
          role: "owner",
        },
        {
          userId: testUserId,
          organizationId: testOrgId2,
          role: "member",
        },
      ])

      const result = await resolveUserActiveOrganization(testUserId)
      expect(result).toEqual({
        organizationId: null,
        status: "multiple_organizations_no_preference",
        count: 2,
      })
    })

    it("resolves explicitly set preference when user has multiple organizations", async () => {
      await db.insert(schema.member).values([
        {
          userId: testUserId,
          organizationId: testOrgId1,
          role: "owner",
        },
        {
          userId: testUserId,
          organizationId: testOrgId2,
          role: "member",
        },
      ])

      // Set preference to org2
      await setActiveOrganizationPreference(testUserId, testOrgId2)

      const result = await resolveUserActiveOrganization(testUserId)
      expect(result).toEqual({
        organizationId: testOrgId2,
        status: "preference",
      })
    })

    it("rejects setting preference if user is not a member", async () => {
      await expect(
        setActiveOrganizationPreference(testUserId, testOrgId1),
      ).rejects.toThrow(/not a member/)
    })

    it("cleans up stale preference and falls back when membership is revoked", async () => {
      await db.insert(schema.member).values([
        {
          userId: testUserId,
          organizationId: testOrgId1,
          role: "owner",
        },
        {
          userId: testUserId,
          organizationId: testOrgId2,
          role: "member",
        },
      ])

      await setActiveOrganizationPreference(testUserId, testOrgId2)

      // Remove user from org2
      await db
        .delete(schema.member)
        .where(eq(schema.member.organizationId, testOrgId2))

      // Resolving now should clean up stale preference and auto-select org1 (only 1 remaining)
      const result = await resolveUserActiveOrganization(testUserId)
      expect(result).toEqual({
        organizationId: testOrgId1,
        status: "single_membership",
      })
    })

    it("clears active organization preference on request", async () => {
      await db.insert(schema.member).values({
        userId: testUserId,
        organizationId: testOrgId1,
        role: "owner",
      })

      await setActiveOrganizationPreference(testUserId, testOrgId1)
      await clearActiveOrganizationPreference(testUserId)

      const [pref] = await db
        .select()
        .from(schema.userActiveOrganization)
        .where(eq(schema.userActiveOrganization.userId, testUserId))
      expect(pref).toBeUndefined()
    })
  })
})
