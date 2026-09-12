import { afterAll, beforeAll, describe, expect, it } from "bun:test"
import type { QueryClient } from "@tanstack/react-query"
import { and, db, eq, schema } from "@workspace/database"

import { closeMailTransport, setMailTransport } from "@/lib/mail"
import {
  invalidateOrganizationQueries,
  organizationKeys,
  slugAvailabilityQueryOptions,
} from "./queries"
import {
  ConflictError,
  cancelInvitation,
  checkSlugAvailability,
  createOrganization,
  ForbiddenError,
  getActiveOrganization,
  getOrganizationInvitations,
  getOrganizationMembers,
  inviteMember,
  listOrganizations,
  removeMember,
  setActiveOrganization,
  updateMemberRole,
} from "./server"

describe("Organization Server Functions & Domain Logic (Atom 5)", () => {
  let testUserA: typeof schema.user.$inferSelect
  let testUserB: typeof schema.user.$inferSelect
  let testUserC: typeof schema.user.$inferSelect
  let testUserD: typeof schema.user.$inferSelect
  let testSessionA: typeof schema.session.$inferSelect
  let createdOrgId = ""

  beforeAll(async () => {
    // Configure mock mail transport to avoid outbound network timeouts
    setMailTransport({
      sendMail: async () => ({ messageId: "mock-message-id" }),
      close: () => {},
    } as unknown as Parameters<typeof setMailTransport>[0])

    // Clean up test data
    await db.delete(schema.invitation)
    await db.delete(schema.member)
    await db.delete(schema.userActiveOrganization)
    await db.delete(schema.organization)
    await db.delete(schema.session)
    await db.delete(schema.user)

    // Create test users
    const [userA] = await db
      .insert(schema.user)
      .values({
        email: "alice@example.com",
        name: "Alice Founder",
        emailVerified: true,
      })
      .returning()

    const [userB] = await db
      .insert(schema.user)
      .values({
        email: "bob@example.com",
        name: "Bob Colleague",
        emailVerified: true,
      })
      .returning()

    const [userC] = await db
      .insert(schema.user)
      .values({
        email: "charlie@example.com",
        name: "Charlie Outsider",
        emailVerified: true,
      })
      .returning()

    const [userD] = await db
      .insert(schema.user)
      .values({
        email: "dan@example.com",
        name: "Dan Admin",
        emailVerified: true,
      })
      .returning()

    testUserA = userA
    testUserB = userB
    testUserC = userC
    testUserD = userD

    const [sessionA] = await db
      .insert(schema.session)
      .values({
        userId: userA.id,
        token: "alice-session-token",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      })
      .returning()

    testSessionA = sessionA
  })

  afterAll(async () => {
    closeMailTransport()
    await db.delete(schema.invitation)
    await db.delete(schema.member)
    await db.delete(schema.userActiveOrganization)
    await db.delete(schema.organization)
    await db.delete(schema.session)
    await db.delete(schema.user)
  })

  describe("checkSlugAvailability", () => {
    it("reports valid new slug as available", async () => {
      const result = await checkSlugAvailability({ slug: "acme-corp" })
      expect(result.available).toBe(true)
      expect(result.slug).toBe("acme-corp")
    })

    it("rejects reserved slugs", async () => {
      const result = await checkSlugAvailability({ slug: "settings" })
      expect(result.available).toBe(false)
      expect(result.reason).toContain("reserved")
    })

    it("rejects invalid formats like special characters or too short", async () => {
      const result = await checkSlugAvailability({ slug: "a" })
      expect(result.available).toBe(false)
      expect(result.reason).toContain("between 3 and 48")
    })
  })

  describe("createOrganization", () => {
    it("creates an organization with caller as owner and sets active preference", async () => {
      const org = await createOrganization(testUserA.id, testSessionA.id, {
        name: "Acme Laboratories",
        slug: "acme-labs",
      })

      expect(org.id).toBeDefined()
      expect(org.slug).toBe("acme-labs")
      expect(org.name).toBe("Acme Laboratories")
      createdOrgId = org.id

      // Verify membership
      const [member] = await db
        .select()
        .from(schema.member)
        .where(
          and(
            eq(schema.member.organizationId, org.id),
            eq(schema.member.userId, testUserA.id),
          ),
        )

      expect(member).toBeDefined()
      expect(member.role).toBe("owner")

      // Verify active organization preference
      const [pref] = await db
        .select()
        .from(schema.userActiveOrganization)
        .where(eq(schema.userActiveOrganization.userId, testUserA.id))

      expect(pref.organizationId).toBe(org.id)

      // Verify session update
      const [session] = await db
        .select()
        .from(schema.session)
        .where(eq(schema.session.id, testSessionA.id))

      expect(session.activeOrganizationId).toBe(org.id)
    })

    it("rejects duplicate slug with ConflictError", async () => {
      expect(
        createOrganization(testUserA.id, testSessionA.id, {
          name: "Duplicate Org",
          slug: "acme-labs",
        }),
      ).rejects.toThrow(ConflictError)
    })

    it("rejects invalid or reserved slug with ConflictError defensively", async () => {
      expect(
        createOrganization(testUserA.id, testSessionA.id, {
          name: "Settings Org",
          slug: "settings",
        }),
      ).rejects.toThrow(ConflictError)

      expect(
        createOrganization(testUserA.id, testSessionA.id, {
          name: "Short Org",
          slug: "ab",
        }),
      ).rejects.toThrow(ConflictError)
    })
  })

  describe("listOrganizations", () => {
    it("lists organizations with roles and member count", async () => {
      const list = await listOrganizations(testUserA.id, createdOrgId)
      expect(list.length).toBe(1)
      expect(list[0].id).toBe(createdOrgId)
      expect(list[0].role).toBe("owner")
      expect(list[0].memberCount).toBe(1)
      expect(list[0].isActive).toBe(true)
    })
  })

  describe("getActiveOrganization", () => {
    it("returns active organization details with caller role", async () => {
      const active = await getActiveOrganization(testUserA.id, createdOrgId)
      expect(active).not.toBeNull()
      expect(active?.organization.id).toBe(createdOrgId)
      expect(active?.role).toBe("owner")
      expect(active?.memberCount).toBe(1)
    })

    it("returns null when user has no organizations", async () => {
      const active = await getActiveOrganization(testUserC.id, null)
      expect(active).toBeNull()
    })

    it("falls back to another organization when session has stale activeOrgId", async () => {
      // Create second organization with User B as owner
      const [orgTwo] = await db
        .insert(schema.organization)
        .values({
          name: "Second Org",
          slug: "second-org-b",
        })
        .returning()

      await db.insert(schema.member).values({
        organizationId: orgTwo.id,
        userId: testUserB.id,
        role: "owner",
      })

      // Create a session for User B with a stale activeOrgId pointing to createdOrgId (which User B is not a member of)
      const staleOrgId = createdOrgId
      const [sessionB] = await db
        .insert(schema.session)
        .values({
          userId: testUserB.id,
          token: "bob-session-stale",
          activeOrganizationId: staleOrgId,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        })
        .returning()

      // Also set a stale active preference for User B
      await db
        .insert(schema.userActiveOrganization)
        .values({
          userId: testUserB.id,
          organizationId: staleOrgId,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: schema.userActiveOrganization.userId,
          set: { organizationId: staleOrgId, updatedAt: new Date() },
        })

      // Call getActiveOrganization with the stale activeOrgId
      const active = await getActiveOrganization(testUserB.id, staleOrgId)

      // Fallback resolves orgTwo
      expect(active).not.toBeNull()
      expect(active?.organization.id).toBe(orgTwo.id)
      expect(active?.role).toBe("owner")

      // Verify the stale session activeOrganizationId was cleared
      const [updatedSession] = await db
        .select()
        .from(schema.session)
        .where(eq(schema.session.id, sessionB.id))

      expect(updatedSession.activeOrganizationId).toBeNull()

      // Clean up orgTwo member
      await db
        .delete(schema.member)
        .where(eq(schema.member.organizationId, orgTwo.id))
      await db
        .delete(schema.organization)
        .where(eq(schema.organization.id, orgTwo.id))
      await db
        .delete(schema.userActiveOrganization)
        .where(eq(schema.userActiveOrganization.userId, testUserB.id))
      await db.delete(schema.session).where(eq(schema.session.id, sessionB.id))
    })
  })

  describe("setActiveOrganization", () => {
    it("rejects setting an organization the caller is not a member of", async () => {
      // Create a foreign organization without Alice
      const [foreignOrg] = await db
        .insert(schema.organization)
        .values({
          name: "Foreign Org",
          slug: "foreign-org",
        })
        .returning()

      expect(
        setActiveOrganization(testUserA.id, testSessionA.id, {
          organizationId: foreignOrg.id,
        }),
      ).rejects.toThrow(ForbiddenError)
    })

    it("successfully sets active organization when caller is a member", async () => {
      const result = await setActiveOrganization(
        testUserA.id,
        testSessionA.id,
        {
          organizationId: createdOrgId,
        },
      )
      expect(result.success).toBe(true)
      expect(result.organizationId).toBe(createdOrgId)
    })
  })

  describe("Member Management & Invariants", () => {
    let memberBId: string
    let memberDId: string

    it("adds User B as a member and retrieves organization members", async () => {
      const [newMember] = await db
        .insert(schema.member)
        .values({
          organizationId: createdOrgId,
          userId: testUserB.id,
          role: "member",
        })
        .returning()

      memberBId = newMember.id

      const result = await getOrganizationMembers(testUserA.id, {
        organizationId: createdOrgId,
      })

      expect(result.callerRole).toBe("owner")
      expect(result.members.length).toBe(2)
      const bob = result.members.find((m) => m.userId === testUserB.id)
      expect(bob?.user.email).toBe("bob@example.com")
      expect(bob?.role).toBe("member")
    })

    it("blocks non-members from viewing organization members", async () => {
      expect(
        getOrganizationMembers(testUserC.id, {
          organizationId: createdOrgId,
        }),
      ).rejects.toThrow(ForbiddenError)
    })

    it("promotes User B to admin", async () => {
      const result = await updateMemberRole(testUserA.id, {
        organizationId: createdOrgId,
        memberId: memberBId,
        role: "admin",
      })

      expect(result.success).toBe(true)
      expect(result.role).toBe("admin")
    })

    it("adds User D as an admin", async () => {
      const [memberD] = await db
        .insert(schema.member)
        .values({
          organizationId: createdOrgId,
          userId: testUserD.id,
          role: "admin",
        })
        .returning()

      memberDId = memberD.id
      expect(memberDId).toBeDefined()
    })

    it("admin cannot invite owner (ForbiddenError)", async () => {
      expect(
        inviteMember(testUserB.id, testUserB.name, {
          organizationId: createdOrgId,
          email: "another-owner@example.com",
          role: "owner",
        }),
      ).rejects.toThrow("Only organization owners can invite new owners")
    })

    it("admin cannot invite admin (ForbiddenError)", async () => {
      expect(
        inviteMember(testUserB.id, testUserB.name, {
          organizationId: createdOrgId,
          email: "another-admin@example.com",
          role: "admin",
        }),
      ).rejects.toThrow("Admins can only invite regular members")
    })

    it("admin cannot remove another admin (ForbiddenError)", async () => {
      expect(
        removeMember(testUserB.id, {
          organizationId: createdOrgId,
          memberId: memberDId,
        }),
      ).rejects.toThrow("Admins can only remove regular members")
    })

    it("sole owner invariant: prevents demoting the only owner", async () => {
      const [aliceMember] = await db
        .select()
        .from(schema.member)
        .where(
          and(
            eq(schema.member.organizationId, createdOrgId),
            eq(schema.member.userId, testUserA.id),
          ),
        )

      expect(
        updateMemberRole(testUserA.id, {
          organizationId: createdOrgId,
          memberId: aliceMember.id,
          role: "member",
        }),
      ).rejects.toThrow(ForbiddenError)
    })

    it("sole owner invariant: prevents removing the only owner", async () => {
      const [aliceMember] = await db
        .select()
        .from(schema.member)
        .where(
          and(
            eq(schema.member.organizationId, createdOrgId),
            eq(schema.member.userId, testUserA.id),
          ),
        )

      expect(
        removeMember(testUserA.id, {
          organizationId: createdOrgId,
          memberId: aliceMember.id,
        }),
      ).rejects.toThrow(ForbiddenError)
    })

    it("allows removing a member, clears active preference AND clears session activeOrganizationId", async () => {
      // Set Bob's active preference to this org
      await db
        .insert(schema.userActiveOrganization)
        .values({
          userId: testUserB.id,
          organizationId: createdOrgId,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: schema.userActiveOrganization.userId,
          set: { organizationId: createdOrgId, updatedAt: new Date() },
        })

      // Create a session for Bob with activeOrganizationId set to createdOrgId
      const [sessionB] = await db
        .insert(schema.session)
        .values({
          userId: testUserB.id,
          token: "bob-session-remove-test",
          activeOrganizationId: createdOrgId,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        })
        .returning()

      const removeResult = await removeMember(testUserA.id, {
        organizationId: createdOrgId,
        memberId: memberBId,
      })

      expect(removeResult.success).toBe(true)

      // Verify Bob was removed from member table
      const [deletedMember] = await db
        .select()
        .from(schema.member)
        .where(eq(schema.member.id, memberBId))

      expect(deletedMember).toBeUndefined()

      // Verify Bob's active preference was cleared
      const [clearedPref] = await db
        .select()
        .from(schema.userActiveOrganization)
        .where(eq(schema.userActiveOrganization.userId, testUserB.id))

      expect(clearedPref).toBeUndefined()

      // Verify Bob's session activeOrganizationId was cleared
      const [clearedSession] = await db
        .select()
        .from(schema.session)
        .where(eq(schema.session.id, sessionB.id))

      expect(clearedSession.activeOrganizationId).toBeNull()

      // Also clean up User D
      await removeMember(testUserA.id, {
        organizationId: createdOrgId,
        memberId: memberDId,
      })
    })
  })

  describe("Invitations Management", () => {
    let invitationId: string

    it("creates an invitation when called by owner and tracks email delivery", async () => {
      const result = await inviteMember(testUserA.id, testUserA.name, {
        organizationId: createdOrgId,
        email: "invitee@example.com",
        role: "member",
      })

      expect(result.invitation).toBeDefined()
      expect(result.invitation.id).toBeDefined()
      expect(result.invitation.email).toBe("invitee@example.com")
      expect(result.invitation.role).toBe("member")
      expect(result.invitation.status).toBe("pending")
      expect(result.emailSent).toBe(true)
      invitationId = result.invitation.id
    })

    it("inviting existing member throws ConflictError", async () => {
      expect(
        inviteMember(testUserA.id, testUserA.name, {
          organizationId: createdOrgId,
          email: "alice@example.com", // Alice is already owner
          role: "member",
        }),
      ).rejects.toThrow(ConflictError)
    })

    it("lists pending invitations for owner/admin", async () => {
      const list = await getOrganizationInvitations(testUserA.id, {
        organizationId: createdOrgId,
      })

      expect(list.length).toBe(1)
      expect(list[0].email).toBe("invitee@example.com")
    })

    it("rejects non-owner/admin from inviting", async () => {
      expect(
        inviteMember(testUserC.id, testUserC.name, {
          organizationId: createdOrgId,
          email: "another@example.com",
          role: "member",
        }),
      ).rejects.toThrow(ForbiddenError)
    })

    it("cancels an invitation", async () => {
      const cancelResult = await cancelInvitation(testUserA.id, {
        organizationId: createdOrgId,
        invitationId,
      })

      expect(cancelResult.success).toBe(true)

      const list = await getOrganizationInvitations(testUserA.id, {
        organizationId: createdOrgId,
      })
      expect(list.length).toBe(0)
    })
  })

  describe("Query Keys & Invalidation Helpers", () => {
    it("generates structured query keys", () => {
      expect(organizationKeys.lists()).toEqual(["organizations", "list"])
      expect(organizationKeys.active()).toEqual(["organizations", "active"])
      expect(organizationKeys.membersRoot()).toEqual([
        "organizations",
        "members",
      ])
      expect(organizationKeys.members("org-123")).toEqual([
        "organizations",
        "members",
        "org-123",
      ])
      expect(organizationKeys.invitationsRoot()).toEqual([
        "organizations",
        "invitations",
      ])
      expect(organizationKeys.invitations("org-123")).toEqual([
        "organizations",
        "invitations",
        "org-123",
      ])
      expect(organizationKeys.slugCheck("my-slug")).toEqual([
        "organizations",
        "slug-check",
        "my-slug",
      ])
    })

    it("slugAvailabilityQueryOptions handles null and undefined safely", () => {
      const nullSlugOpts = slugAvailabilityQueryOptions(null)
      expect([...nullSlugOpts.queryKey]).toEqual([
        "organizations",
        "slug-check",
        "",
      ])
      expect(nullSlugOpts.enabled).toBe(false)

      const undefinedSlugOpts = slugAvailabilityQueryOptions(undefined)
      expect([...undefinedSlugOpts.queryKey]).toEqual([
        "organizations",
        "slug-check",
        "",
      ])
      expect(undefinedSlugOpts.enabled).toBe(false)

      const validSlugOpts = slugAvailabilityQueryOptions("my-slug")
      expect([...validSlugOpts.queryKey]).toEqual([
        "organizations",
        "slug-check",
        "my-slug",
      ])
      expect(validSlugOpts.enabled).toBe(true)
    })

    it("invokes queryClient invalidation without errors", async () => {
      const invalidatedKeys: unknown[] = []
      const fakeQueryClient = {
        invalidateQueries: async (opts: { queryKey: unknown }) => {
          invalidatedKeys.push(opts.queryKey)
        },
      }

      await invalidateOrganizationQueries(
        fakeQueryClient as unknown as QueryClient,
        "org-test",
      )
      expect(invalidatedKeys.length).toBe(4)
      expect(invalidatedKeys).toContainEqual(["organizations", "list"])
      expect(invalidatedKeys).toContainEqual(["organizations", "active"])
      expect(invalidatedKeys).toContainEqual([
        "organizations",
        "members",
        "org-test",
      ])
      expect(invalidatedKeys).toContainEqual([
        "organizations",
        "invitations",
        "org-test",
      ])
    })
  })
})
