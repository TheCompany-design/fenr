import { describe, expect, it } from "bun:test"
import { db, eq, schema } from "@workspace/database"

import { auth, type Session } from "./auth"
import {
  authClient,
  organization,
  signIn,
  signOut,
  signUp,
  useActiveOrganization,
  useListOrganizations,
  useSession,
} from "./auth-client"

type DbSession = Session["session"]

describe("Better Auth Configuration & Plugins", () => {
  describe("Server Auth Instance & Plugin Invariants", () => {
    it("initializes with required configuration and options", () => {
      expect(auth).toBeDefined()
      expect(auth.options.baseURL).toBeDefined()
      expect(auth.options.secret).toBeDefined()
    })

    it("has magic-link, organization, and tanstackStartCookies plugins configured in correct order", () => {
      const plugins = auth.options.plugins || []
      const pluginIds = plugins.map((p) => p.id)

      expect(pluginIds).toContain("magic-link")
      expect(pluginIds).toContain("organization")
      expect(pluginIds).toContain("tanstack-start-cookies")

      // Invariant: tanstackStartCookies must be strictly the last plugin
      const lastPlugin = plugins[plugins.length - 1]
      expect(lastPlugin.id).toBe("tanstack-start-cookies")
    })

    it("has organization API endpoints registered", () => {
      expect(auth.api.createOrganization).toBeDefined()
      expect(auth.api.setActiveOrganization).toBeDefined()
      expect(auth.api.getFullOrganization).toBeDefined()
      expect(auth.api.listOrganizations).toBeDefined()
      expect(auth.api.createInvitation).toBeDefined()
      expect(auth.api.acceptInvitation).toBeDefined()
      expect(auth.api.rejectInvitation).toBeDefined()
      expect(auth.api.cancelInvitation).toBeDefined()
    })

    it("has magic link API endpoints registered", () => {
      expect(auth.api.signInMagicLink).toBeDefined()
      expect(auth.api.magicLinkVerify).toBeDefined()
    })
  })

  describe("Client Auth Instance", () => {
    it("exports core auth methods and hooks", () => {
      expect(typeof signIn).toBe("function")
      expect(typeof signUp).toBe("function")
      expect(typeof signOut).toBe("function")
      expect(typeof useSession).toBe("function")
    })

    it("exports organization client methods and hooks", () => {
      expect(organization).toBeDefined()
      expect(typeof organization.create).toBe("function")
      expect(typeof organization.setActive).toBe("function")
      expect(typeof organization.inviteMember).toBe("function")
      expect(typeof useActiveOrganization).toBe("function")
      expect(typeof useListOrganizations).toBe("function")
    })

    it("has magicLink signIn method attached", () => {
      expect(typeof authClient.signIn.magicLink).toBe("function")
    })
  })

  describe("Database Session Lifecycle Hooks", () => {
    const sessionHooks = auth.options.databaseHooks?.session

    it("handles null/undefined session objects defensively across all hooks", async () => {
      // @ts-expect-error - testing defensive null guard
      const beforeRes = await sessionHooks?.create?.before?.(null)
      expect(beforeRes?.data).toBeNull()

      // @ts-expect-error - testing defensive null guard
      await expect(sessionHooks?.create?.after?.(null)).resolves.toBeUndefined()
      // @ts-expect-error - testing defensive null guard
      await expect(sessionHooks?.update?.after?.(null)).resolves.toBeUndefined()
      // @ts-expect-error - testing defensive null guard
      await expect(sessionHooks?.delete?.after?.(null)).resolves.toBeUndefined()
    })

    it("auto-resolves active organization on session.create.before when missing", async () => {
      // Create user and single org in DB
      const [testUser] = await db
        .insert(schema.user)
        .values({
          name: "Hook Test User",
          email: `hook-test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
        })
        .returning()

      const [testOrg] = await db
        .insert(schema.organization)
        .values({
          name: "Hook Test Org",
          slug: `hook-test-org-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        })
        .returning()

      await db.insert(schema.member).values({
        userId: testUser.id,
        organizationId: testOrg.id,
        role: "owner",
      })

      const mockSession: DbSession = {
        id: "mock-session-id",
        userId: testUser.id,
        token: "mock-token",
        expiresAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        ipAddress: null,
        userAgent: null,
        activeOrganizationId: null,
      }

      const res = await sessionHooks?.create?.before?.(mockSession)
      expect(res?.data?.activeOrganizationId).toBe(testOrg.id)

      // Clean up
      await db.delete(schema.user).where(eq(schema.user.id, testUser.id))
      await db
        .delete(schema.organization)
        .where(eq(schema.organization.id, testOrg.id))
    })

    it("leaves pre-set activeOrganizationId unchanged on session.create.before", async () => {
      const mockSession: DbSession = {
        id: "mock-session-id-preset",
        userId: "0191ca7f-8e7c-7a91-9c12-3456789abcde",
        token: "mock-token-preset",
        expiresAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        ipAddress: null,
        userAgent: null,
        activeOrganizationId: "0191ca7f-8e7c-7a91-9c12-999999999999",
      }

      const res = await sessionHooks?.create?.before?.(mockSession)
      expect(res?.data?.activeOrganizationId).toBe(
        "0191ca7f-8e7c-7a91-9c12-999999999999",
      )
    })

    it("does NOT wipe active organization preference on routine session update (sliding expiration touch)", async () => {
      const [testUser] = await db
        .insert(schema.user)
        .values({
          name: "Routine Touch User",
          email: `routine-${Date.now()}@example.com`,
        })
        .returning()

      const [testOrg] = await db
        .insert(schema.organization)
        .values({
          name: "Routine Touch Org",
          slug: `routine-org-${Date.now()}`,
        })
        .returning()

      await db.insert(schema.member).values({
        userId: testUser.id,
        organizationId: testOrg.id,
        role: "owner",
      })

      // User has existing preference for testOrg
      await db.insert(schema.userActiveOrganization).values({
        userId: testUser.id,
        organizationId: testOrg.id,
        updatedAt: new Date(),
      })

      // Simulate routine session touch where activeOrganizationId is null or undefined
      const touchSession: DbSession = {
        id: "routine-session-id",
        userId: testUser.id,
        token: "routine-token",
        expiresAt: new Date(Date.now() + 86400000),
        createdAt: new Date(),
        updatedAt: new Date(),
        ipAddress: null,
        userAgent: null,
        activeOrganizationId: null,
      }

      await sessionHooks?.update?.after?.(touchSession)

      // Invariant check: Preference MUST NOT be deleted!
      const [pref] = await db
        .select()
        .from(schema.userActiveOrganization)
        .where(eq(schema.userActiveOrganization.userId, testUser.id))
      expect(pref?.organizationId).toBe(testOrg.id)

      // Clean up
      await db.delete(schema.user).where(eq(schema.user.id, testUser.id))
      await db
        .delete(schema.organization)
        .where(eq(schema.organization.id, testOrg.id))
    })

    it("syncs preference on session.update.after when activeOrganizationId is a valid string", async () => {
      const [testUser] = await db
        .insert(schema.user)
        .values({
          name: "Update Sync User",
          email: `sync-${Date.now()}@example.com`,
        })
        .returning()

      const [testOrg] = await db
        .insert(schema.organization)
        .values({
          name: "Update Sync Org",
          slug: `sync-org-${Date.now()}`,
        })
        .returning()

      await db.insert(schema.member).values({
        userId: testUser.id,
        organizationId: testOrg.id,
        role: "owner",
      })

      const updateSession: DbSession = {
        id: "sync-session-id",
        userId: testUser.id,
        token: "sync-token",
        expiresAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        ipAddress: null,
        userAgent: null,
        activeOrganizationId: testOrg.id,
      }

      await sessionHooks?.update?.after?.(updateSession)

      // Invariant check: Preference MUST be recorded!
      const [pref] = await db
        .select()
        .from(schema.userActiveOrganization)
        .where(eq(schema.userActiveOrganization.userId, testUser.id))
      expect(pref?.organizationId).toBe(testOrg.id)

      // Clean up
      await db.delete(schema.user).where(eq(schema.user.id, testUser.id))
      await db
        .delete(schema.organization)
        .where(eq(schema.organization.id, testOrg.id))
    })
  })
})
