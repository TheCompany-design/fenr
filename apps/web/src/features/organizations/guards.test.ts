import { afterAll, beforeAll, describe, expect, it } from "bun:test"
import { and, db, eq, inArray, schema } from "@workspace/database"

import { resolveAppOrganizationAccess } from "./server"

describe("resolveAppOrganizationAccess Behavioral Tests (Atom 6)", () => {
  const createdUserIds: string[] = []
  const createdOrgIds: string[] = []

  let userZeroOrgs: typeof schema.user.$inferSelect
  let userSingleOrg: typeof schema.user.$inferSelect
  let userMultiNoPref: typeof schema.user.$inferSelect
  let userWithPref: typeof schema.user.$inferSelect
  let userRevokedPref: typeof schema.user.$inferSelect

  let orgAlpha: typeof schema.organization.$inferSelect
  let orgBeta: typeof schema.organization.$inferSelect
  let orgGamma: typeof schema.organization.$inferSelect

  beforeAll(async () => {
    // 1. Create test users
    const [u0, u1, uMulti, uPref, uRevoke] = await db
      .insert(schema.user)
      .values([
        {
          email: "atom6-u0@example.com",
          name: "User Zero Orgs",
          emailVerified: true,
        },
        {
          email: "atom6-u1@example.com",
          name: "User Single Org",
          emailVerified: true,
        },
        {
          email: "atom6-umulti@example.com",
          name: "User Multi No Pref",
          emailVerified: true,
        },
        {
          email: "atom6-upref@example.com",
          name: "User With Pref",
          emailVerified: true,
        },
        {
          email: "atom6-urevoke@example.com",
          name: "User Revoked Pref",
          emailVerified: true,
        },
      ])
      .returning()

    userZeroOrgs = u0
    userSingleOrg = u1
    userMultiNoPref = uMulti
    userWithPref = uPref
    userRevokedPref = uRevoke

    createdUserIds.push(u0.id, u1.id, uMulti.id, uPref.id, uRevoke.id)

    // 2. Create organizations
    const [oAlpha, oBeta, oGamma] = await db
      .insert(schema.organization)
      .values([
        {
          name: "Atom6 Alpha Corp",
          slug: `atom6-alpha-${Date.now()}`,
        },
        {
          name: "Atom6 Beta Ltd",
          slug: `atom6-beta-${Date.now()}`,
        },
        {
          name: "Atom6 Gamma Inc",
          slug: `atom6-gamma-${Date.now()}`,
        },
      ])
      .returning()

    orgAlpha = oAlpha
    orgBeta = oBeta
    orgGamma = oGamma

    createdOrgIds.push(oAlpha.id, oBeta.id, oGamma.id)

    // 3. Set up memberships
    // userSingleOrg belongs to orgAlpha only
    await db.insert(schema.member).values({
      organizationId: orgAlpha.id,
      userId: userSingleOrg.id,
      role: "owner",
    })

    // userMultiNoPref belongs to orgAlpha and orgBeta, with NO preference
    await db.insert(schema.member).values([
      {
        organizationId: orgAlpha.id,
        userId: userMultiNoPref.id,
        role: "member",
      },
      {
        organizationId: orgBeta.id,
        userId: userMultiNoPref.id,
        role: "admin",
      },
    ])

    // userWithPref belongs to orgAlpha and orgBeta, with preference for orgBeta
    await db.insert(schema.member).values([
      {
        organizationId: orgAlpha.id,
        userId: userWithPref.id,
        role: "member",
      },
      {
        organizationId: orgBeta.id,
        userId: userWithPref.id,
        role: "owner",
      },
    ])
    await db.insert(schema.userActiveOrganization).values({
      userId: userWithPref.id,
      organizationId: orgBeta.id,
      updatedAt: new Date(),
    })
  })

  afterAll(async () => {
    // Clean up all data created in this test suite
    if (createdUserIds.length > 0) {
      await db
        .delete(schema.userActiveOrganization)
        .where(inArray(schema.userActiveOrganization.userId, createdUserIds))
      await db
        .delete(schema.member)
        .where(inArray(schema.member.userId, createdUserIds))
      await db
        .delete(schema.session)
        .where(inArray(schema.session.userId, createdUserIds))
      await db
        .delete(schema.user)
        .where(inArray(schema.user.id, createdUserIds))
    }
    if (createdOrgIds.length > 0) {
      await db
        .delete(schema.organization)
        .where(inArray(schema.organization.id, createdOrgIds))
    }
  })

  it("User with 0 memberships returns 'no_organizations'", async () => {
    const access = await resolveAppOrganizationAccess(userZeroOrgs.id)

    expect(access.status).toBe("no_organizations")
  })

  it("User with 1 membership returns 'authorized' with auto-selected organization", async () => {
    const access = await resolveAppOrganizationAccess(userSingleOrg.id)

    expect(access.status).toBe("authorized")
    if (access.status === "authorized") {
      expect(access.activeOrganization.organization.id).toBe(orgAlpha.id)
      expect(access.activeOrganization.role).toBe("owner")
      expect(access.activeOrganization.organization.name).toBe(
        "Atom6 Alpha Corp",
      )
      expect(access.activeOrganization.memberCount).toBeGreaterThanOrEqual(1)
    }
  })

  it("User with >1 memberships and no preference returns 'choose_organization'", async () => {
    const access = await resolveAppOrganizationAccess(userMultiNoPref.id)

    expect(access.status).toBe("choose_organization")
    if (access.status === "choose_organization") {
      expect(access.count).toBe(2)
    }
  })

  it("User with stored preference returns 'authorized' matching preference", async () => {
    const access = await resolveAppOrganizationAccess(userWithPref.id)

    expect(access.status).toBe("authorized")
    if (access.status === "authorized") {
      expect(access.activeOrganization.organization.id).toBe(orgBeta.id)
      expect(access.activeOrganization.role).toBe("owner")
      expect(access.activeOrganization.organization.name).toBe("Atom6 Beta Ltd")
    }
  })

  it("User with currentSessionActiveOrgId matching valid membership returns 'authorized'", async () => {
    const access = await resolveAppOrganizationAccess(
      userWithPref.id,
      orgAlpha.id,
    )

    expect(access.status).toBe("authorized")
    if (access.status === "authorized") {
      expect(access.activeOrganization.organization.id).toBe(orgAlpha.id)
      expect(access.activeOrganization.role).toBe("member")
    }
  })

  describe("Revoked / Invalid Preference Fallbacks", () => {
    it("falls back to single remaining membership when preference is revoked", async () => {
      // Setup userRevokedPref in orgAlpha and orgBeta, preference pointing to orgAlpha
      await db.insert(schema.member).values([
        {
          organizationId: orgAlpha.id,
          userId: userRevokedPref.id,
          role: "member",
        },
        {
          organizationId: orgBeta.id,
          userId: userRevokedPref.id,
          role: "member",
        },
      ])
      await db.insert(schema.userActiveOrganization).values({
        userId: userRevokedPref.id,
        organizationId: orgAlpha.id,
        updatedAt: new Date(),
      })

      // Verify currently authorized to orgAlpha
      const beforeRevocation = await resolveAppOrganizationAccess(
        userRevokedPref.id,
      )
      expect(beforeRevocation.status).toBe("authorized")
      if (beforeRevocation.status === "authorized") {
        expect(beforeRevocation.activeOrganization.organization.id).toBe(
          orgAlpha.id,
        )
      }

      // Revoke membership in orgAlpha
      await db
        .delete(schema.member)
        .where(
          and(
            eq(schema.member.userId, userRevokedPref.id),
            eq(schema.member.organizationId, orgAlpha.id),
          ),
        )

      // Now resolve access: stale preference for orgAlpha is detected and cleared;
      // user now has exactly 1 membership (orgBeta), which is auto-selected!
      const afterRevocation = await resolveAppOrganizationAccess(
        userRevokedPref.id,
      )

      expect(afterRevocation.status).toBe("authorized")
      if (afterRevocation.status === "authorized") {
        expect(afterRevocation.activeOrganization.organization.id).toBe(
          orgBeta.id,
        )
      }
    })

    it("falls back to choose_organization when revoked and >1 memberships remain", async () => {
      // Add userRevokedPref to orgAlpha and orgGamma so they have orgBeta + orgGamma (2 memberships)
      await db.insert(schema.member).values([
        {
          organizationId: orgAlpha.id,
          userId: userRevokedPref.id,
          role: "member",
        },
        {
          organizationId: orgGamma.id,
          userId: userRevokedPref.id,
          role: "member",
        },
      ])
      // Set preference to orgAlpha
      await db
        .insert(schema.userActiveOrganization)
        .values({
          userId: userRevokedPref.id,
          organizationId: orgAlpha.id,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: schema.userActiveOrganization.userId,
          set: {
            organizationId: orgAlpha.id,
            updatedAt: new Date(),
          },
        })

      // Revoke orgAlpha membership
      await db
        .delete(schema.member)
        .where(
          and(
            eq(schema.member.userId, userRevokedPref.id),
            eq(schema.member.organizationId, orgAlpha.id),
          ),
        )

      // Stale preference is cleared, user has 2 remaining orgs (orgBeta, orgGamma)
      // and no preference -> returns choose_organization with count: 2
      const access = await resolveAppOrganizationAccess(userRevokedPref.id)
      expect(access.status).toBe("choose_organization")
      if (access.status === "choose_organization") {
        expect(access.count).toBe(2)
      }
    })

    it("falls back to no_organizations when revoked and 0 memberships remain", async () => {
      // Remove remaining memberships for userRevokedPref
      await db
        .delete(schema.member)
        .where(eq(schema.member.userId, userRevokedPref.id))

      const access = await resolveAppOrganizationAccess(userRevokedPref.id)
      expect(access.status).toBe("no_organizations")
    })

    it("clears stale session activeOrganizationId and resolves correctly", async () => {
      // Create a dummy session for userSingleOrg with a nonexistent activeOrganizationId
      const [testSession] = await db
        .insert(schema.session)
        .values({
          userId: userSingleOrg.id,
          token: `token-${Date.now()}`,
          expiresAt: new Date(Date.now() + 60000),
          activeOrganizationId: orgGamma.id, // userSingleOrg does not belong to orgGamma!
        })
        .returning()

      const access = await resolveAppOrganizationAccess(
        userSingleOrg.id,
        testSession.activeOrganizationId,
      )

      // Invalid session active org is cleared, falls back to auto-selecting orgAlpha
      expect(access.status).toBe("authorized")
      if (access.status === "authorized") {
        expect(access.activeOrganization.organization.id).toBe(orgAlpha.id)
      }

      // Check session in DB was updated to null activeOrganizationId
      const [updatedSession] = await db
        .select()
        .from(schema.session)
        .where(eq(schema.session.id, testSession.id))
      expect(updatedSession.activeOrganizationId).toBeNull()
    })
  })

  describe("Defensive UUID Input Handling", () => {
    it("handles non-UUID userId and session activeOrgId without Postgres 22P02 crash", async () => {
      const accessInvalidUser = await resolveAppOrganizationAccess(
        "not-a-real-uuid",
        "legacy-session-org-id",
      )
      expect(accessInvalidUser.status).toBe("no_organizations")

      const accessValidUserCorruptedOrg = await resolveAppOrganizationAccess(
        userSingleOrg.id,
        "corrupted-non-uuid-string",
      )
      // Corrupted org ID is ignored and auto-selects valid orgAlpha
      expect(accessValidUserCorruptedOrg.status).toBe("authorized")
      if (accessValidUserCorruptedOrg.status === "authorized") {
        expect(
          accessValidUserCorruptedOrg.activeOrganization.organization.id,
        ).toBe(orgAlpha.id)
      }
    })
  })
})
