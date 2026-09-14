import { afterAll, beforeAll, describe, expect, it } from "bun:test"
import type { QueryClient } from "@tanstack/react-query"
import { and, db, eq, schema } from "@workspace/database"

import { closeMailTransport, setMailTransport } from "@/lib/mail"
import {
  acceptInvitation,
  ConflictError,
  cancelInvitation,
  checkSlugAvailability,
  createOrganization,
  deleteOrganization,
  ForbiddenError,
  getActiveOrganization,
  getInvitationDetails,
  getOrganizationInvitations,
  getOrganizationMembers,
  inviteMember,
  leaveOrganization,
  listOrganizations,
  NotFoundError,
  removeMember,
  setActiveOrganization,
  updateMemberRole,
  updateOrganization,
} from "./operations"
import {
  invalidateOrganizationQueries,
  invitationDetailsQueryOptions,
  organizationKeys,
  slugAvailabilityQueryOptions,
} from "./queries"

describe("Organization Server Functions & Domain Logic (Atom 5)", () => {
  let testUserA: typeof schema.user.$inferSelect
  let testUserB: typeof schema.user.$inferSelect
  let testUserC: typeof schema.user.$inferSelect
  let testUserD: typeof schema.user.$inferSelect
  let testSessionA: typeof schema.session.$inferSelect
  let createdOrgId = ""

  async function ensureCreatedOrg() {
    if (createdOrgId) {
      const exists = await db.query.organization.findFirst({
        where: eq(schema.organization.id, createdOrgId),
      })
      if (exists) return createdOrgId
    }
    const [existing] = await db
      .select()
      .from(schema.organization)
      .where(eq(schema.organization.slug, "acme-labs"))
      .limit(1)
    if (existing) {
      createdOrgId = existing.id
      return createdOrgId
    }
    const org = await createOrganization(testUserA.id, testSessionA.id, {
      name: "Acme Laboratories",
      slug: "acme-labs",
    })
    createdOrgId = org.id
    return createdOrgId
  }

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
      await ensureCreatedOrg()
      await expect(
        createOrganization(testUserA.id, testSessionA.id, {
          name: "Duplicate Org",
          slug: "acme-labs",
        }),
      ).rejects.toThrow(ConflictError)
    })

    it("rejects invalid or reserved slug with ConflictError defensively", async () => {
      await expect(
        createOrganization(testUserA.id, testSessionA.id, {
          name: "Settings Org",
          slug: "settings",
        }),
      ).rejects.toThrow(ConflictError)

      await expect(
        createOrganization(testUserA.id, testSessionA.id, {
          name: "Short Org",
          slug: "ab",
        }),
      ).rejects.toThrow(ConflictError)
    })
  })

  describe("listOrganizations", () => {
    it("lists organizations with roles and member count", async () => {
      const orgId = await ensureCreatedOrg()
      const list = await listOrganizations(testUserA.id, orgId)
      expect(list.length).toBe(1)
      expect(list[0].id).toBe(orgId)
      expect(list[0].role).toBe("owner")
      expect(list[0].memberCount).toBe(1)
      expect(list[0].isActive).toBe(true)
    })
  })

  describe("getActiveOrganization", () => {
    it("returns active organization details with caller role", async () => {
      const orgId = await ensureCreatedOrg()
      const active = await getActiveOrganization(testUserA.id, orgId)
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

      await expect(
        setActiveOrganization(testUserA.id, testSessionA.id, {
          organizationId: foreignOrg.id,
        }),
      ).rejects.toThrow(ForbiddenError)
    })

    it("successfully sets active organization when caller is a member", async () => {
      const orgId = await ensureCreatedOrg()
      const result = await setActiveOrganization(
        testUserA.id,
        testSessionA.id,
        {
          organizationId: orgId,
        },
      )
      expect(result.success).toBe(true)
      expect(result.organizationId).toBe(orgId)
    })
  })

  describe("Member Management & Invariants", () => {
    async function ensureMemberB(role: "member" | "admin" = "member") {
      const orgId = await ensureCreatedOrg()
      const existing = await db.query.member.findFirst({
        where: and(
          eq(schema.member.organizationId, orgId),
          eq(schema.member.userId, testUserB.id),
        ),
      })
      if (existing) {
        if (existing.role !== role) {
          await db
            .update(schema.member)
            .set({ role })
            .where(eq(schema.member.id, existing.id))
        }
        return existing.id
      }
      const [m] = await db
        .insert(schema.member)
        .values({
          organizationId: orgId,
          userId: testUserB.id,
          role,
        })
        .returning()
      return m.id
    }

    async function ensureMemberD(role: "member" | "admin" = "admin") {
      const orgId = await ensureCreatedOrg()
      const existing = await db.query.member.findFirst({
        where: and(
          eq(schema.member.organizationId, orgId),
          eq(schema.member.userId, testUserD.id),
        ),
      })
      if (existing) {
        if (existing.role !== role) {
          await db
            .update(schema.member)
            .set({ role })
            .where(eq(schema.member.id, existing.id))
        }
        return existing.id
      }
      const [m] = await db
        .insert(schema.member)
        .values({
          organizationId: orgId,
          userId: testUserD.id,
          role,
        })
        .returning()
      return m.id
    }

    it("adds User B as a member and retrieves organization members", async () => {
      const orgId = await ensureCreatedOrg()
      await db
        .delete(schema.member)
        .where(
          and(
            eq(schema.member.organizationId, orgId),
            eq(schema.member.userId, testUserB.id),
          ),
        )

      await db
        .insert(schema.member)
        .values({
          organizationId: orgId,
          userId: testUserB.id,
          role: "member",
        })
        .returning()

      const result = await getOrganizationMembers(testUserA.id, {
        organizationId: orgId,
      })

      expect(result.callerRole).toBe("owner")
      expect(result.members.length).toBeGreaterThanOrEqual(2)
      const bob = result.members.find((m) => m.userId === testUserB.id)
      expect(bob?.user.email).toBe("bob@example.com")
      expect(bob?.role).toBe("member")
    })

    it("blocks non-members from viewing organization members", async () => {
      const orgId = await ensureCreatedOrg()
      await expect(
        getOrganizationMembers(testUserC.id, {
          organizationId: orgId,
        }),
      ).rejects.toThrow(ForbiddenError)
    })

    it("promotes User B to admin", async () => {
      const orgId = await ensureCreatedOrg()
      const bId = await ensureMemberB("member")
      const result = await updateMemberRole(testUserA.id, {
        organizationId: orgId,
        memberId: bId,
        role: "admin",
      })

      expect(result.success).toBe(true)
      expect(result.role).toBe("admin")
    })

    it("adds User D as an admin", async () => {
      await ensureCreatedOrg()
      const dId = await ensureMemberD("admin")
      expect(dId).toBeDefined()
    })

    it("admin cannot invite owner (ForbiddenError)", async () => {
      const orgId = await ensureCreatedOrg()
      await ensureMemberB("admin")
      await expect(
        inviteMember(testUserB.id, testUserB.name, {
          organizationId: orgId,
          email: "another-owner@example.com",
          role: "owner",
        }),
      ).rejects.toThrow("Only organization owners can invite new owners")
    })

    it("admin cannot invite admin (ForbiddenError)", async () => {
      const orgId = await ensureCreatedOrg()
      await ensureMemberB("admin")
      await expect(
        inviteMember(testUserB.id, testUserB.name, {
          organizationId: orgId,
          email: "another-admin@example.com",
          role: "admin",
        }),
      ).rejects.toThrow("Admins can only invite regular members")
    })

    it("admin cannot remove another admin (ForbiddenError)", async () => {
      const orgId = await ensureCreatedOrg()
      await ensureMemberB("admin")
      const dId = await ensureMemberD("admin")
      await expect(
        removeMember(testUserB.id, {
          organizationId: orgId,
          memberId: dId,
        }),
      ).rejects.toThrow("Admins can only remove regular members")
    })

    it("sole owner invariant: prevents demoting the only owner", async () => {
      const orgId = await ensureCreatedOrg()
      const [aliceMember] = await db
        .select()
        .from(schema.member)
        .where(
          and(
            eq(schema.member.organizationId, orgId),
            eq(schema.member.userId, testUserA.id),
          ),
        )

      await expect(
        updateMemberRole(testUserA.id, {
          organizationId: orgId,
          memberId: aliceMember.id,
          role: "member",
        }),
      ).rejects.toThrow(ForbiddenError)
    })

    it("sole owner invariant: prevents removing the only owner", async () => {
      const orgId = await ensureCreatedOrg()
      const [aliceMember] = await db
        .select()
        .from(schema.member)
        .where(
          and(
            eq(schema.member.organizationId, orgId),
            eq(schema.member.userId, testUserA.id),
          ),
        )

      await expect(
        removeMember(testUserA.id, {
          organizationId: orgId,
          memberId: aliceMember.id,
        }),
      ).rejects.toThrow(ForbiddenError)
    })

    it("allows removing a member, clears active preference AND clears session activeOrganizationId", async () => {
      const orgId = await ensureCreatedOrg()
      const bId = await ensureMemberB("member")
      const dId = await ensureMemberD("admin")

      // Set Bob's active preference to this org
      await db
        .insert(schema.userActiveOrganization)
        .values({
          userId: testUserB.id,
          organizationId: orgId,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: schema.userActiveOrganization.userId,
          set: { organizationId: orgId, updatedAt: new Date() },
        })

      // Create a session for Bob with activeOrganizationId set to orgId
      const [sessionB] = await db
        .insert(schema.session)
        .values({
          userId: testUserB.id,
          token: "bob-session-remove-test",
          activeOrganizationId: orgId,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        })
        .returning()

      const removeResult = await removeMember(testUserA.id, {
        organizationId: orgId,
        memberId: bId,
      })

      expect(removeResult.success).toBe(true)

      // Verify Bob was removed from member table
      const [deletedMember] = await db
        .select()
        .from(schema.member)
        .where(eq(schema.member.id, bId))

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
        organizationId: orgId,
        memberId: dId,
      })
    })
  })

  describe("Invitations Management", () => {
    let invitationId: string

    it("creates an invitation when called by owner and tracks email delivery", async () => {
      const orgId = await ensureCreatedOrg()
      const result = await inviteMember(testUserA.id, testUserA.name, {
        organizationId: orgId,
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
      const orgId = await ensureCreatedOrg()
      await expect(
        inviteMember(testUserA.id, testUserA.name, {
          organizationId: orgId,
          email: "alice@example.com", // Alice is already owner
          role: "member",
        }),
      ).rejects.toThrow(ConflictError)
    })

    it("lists pending invitations for owner/admin", async () => {
      const orgId = await ensureCreatedOrg()
      if (!invitationId) {
        const result = await inviteMember(testUserA.id, testUserA.name, {
          organizationId: orgId,
          email: "invitee@example.com",
          role: "member",
        })
        invitationId = result.invitation.id
      }
      const list = await getOrganizationInvitations(testUserA.id, {
        organizationId: orgId,
      })

      expect(list.some((i) => i.email === "invitee@example.com")).toBe(true)
    })

    it("rejects non-owner/admin from inviting", async () => {
      const orgId = await ensureCreatedOrg()
      await expect(
        inviteMember(testUserC.id, testUserC.name, {
          organizationId: orgId,
          email: "another@example.com",
          role: "member",
        }),
      ).rejects.toThrow(ForbiddenError)
    })

    it("cancels an invitation", async () => {
      const orgId = await ensureCreatedOrg()
      if (!invitationId) {
        const result = await inviteMember(testUserA.id, testUserA.name, {
          organizationId: orgId,
          email: "cancel-target@example.com",
          role: "member",
        })
        invitationId = result.invitation.id
      }
      const cancelResult = await cancelInvitation(testUserA.id, {
        organizationId: orgId,
        invitationId,
      })

      expect(cancelResult.success).toBe(true)

      const list = await getOrganizationInvitations(testUserA.id, {
        organizationId: orgId,
      })
      expect(list.find((i) => i.id === invitationId)).toBeUndefined()
    })
  })

  describe("Invitation Acceptance & Details (Atom 10)", () => {
    let acceptInviteId = ""
    let expiredInviteId = ""
    let canceledInviteId = ""

    beforeAll(async () => {
      const orgId = await ensureCreatedOrg()
      // 1. Create a fresh pending invitation for testUserB
      const result = await inviteMember(testUserA.id, testUserA.name, {
        organizationId: orgId,
        email: testUserB.email,
        role: "member",
      })
      acceptInviteId = result.invitation.id

      // 2. Insert directly an expired invitation
      const [expiredRecord] = await db
        .insert(schema.invitation)
        .values({
          organizationId: orgId,
          email: testUserD.email,
          role: "member",
          inviterId: testUserA.id,
          status: "pending",
          expiresAt: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
        })
        .returning()
      expiredInviteId = expiredRecord.id

      // 3. Insert a canceled invitation
      const [canceledRecord] = await db
        .insert(schema.invitation)
        .values({
          organizationId: orgId,
          email: testUserB.email,
          role: "member",
          inviterId: testUserA.id,
          status: "canceled",
          expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
        })
        .returning()
      canceledInviteId = canceledRecord.id
    })

    describe("getInvitationDetails", () => {
      it("returns invalid status for malformed or non-UUID id", async () => {
        const result = await getInvitationDetails("not-a-valid-uuid")
        expect(result.status).toBe("invalid")
      })

      it("returns not_found status for non-existent UUID", async () => {
        const result = await getInvitationDetails(
          "018f1a1a-0000-7000-8000-999999999999",
        )
        expect(result.status).toBe("not_found")
      })

      it("returns valid status with sanitized details for pending invite", async () => {
        const result = await getInvitationDetails(acceptInviteId)
        expect(result.status).toBe("valid")
        if (result.status === "valid") {
          expect(result.invitation.email).toBe(testUserB.email)
          expect(result.invitation.role).toBe("member")
          expect(result.invitation.organizationName).toBe("Acme Laboratories")
          expect(result.invitation.inviterName).toBe(testUserA.name)
        }
      })

      it("returns expired status for expired invite", async () => {
        const result = await getInvitationDetails(expiredInviteId)
        expect(result.status).toBe("expired")
      })

      it("returns canceled status for canceled invite", async () => {
        const result = await getInvitationDetails(canceledInviteId)
        expect(result.status).toBe("canceled")
      })
    })

    describe("acceptInvitation", () => {
      it("rejects invalid or malformed invitation ID with NotFoundError", async () => {
        await expect(
          acceptInvitation(testUserB.id, null, testUserB.email, {
            invitationId: "invalid-uuid",
          }),
        ).rejects.toThrow(NotFoundError)
      })

      it("rejects non-existent invitation ID with NotFoundError", async () => {
        await expect(
          acceptInvitation(testUserB.id, null, testUserB.email, {
            invitationId: "018f1a1a-0000-7000-8000-999999999999",
          }),
        ).rejects.toThrow(NotFoundError)
      })

      it("rejects email mismatch with ForbiddenError", async () => {
        // testUserC tries to accept an invitation meant for testUserB
        await expect(
          acceptInvitation(testUserC.id, null, testUserC.email, {
            invitationId: acceptInviteId,
          }),
        ).rejects.toThrow(ForbiddenError)
      })

      it("rejects expired invitation with ConflictError", async () => {
        await expect(
          acceptInvitation(testUserD.id, null, testUserD.email, {
            invitationId: expiredInviteId,
          }),
        ).rejects.toThrow(ConflictError)
      })

      it("rejects canceled invitation with ConflictError", async () => {
        await expect(
          acceptInvitation(testUserB.id, null, testUserB.email, {
            invitationId: canceledInviteId,
          }),
        ).rejects.toThrow(ConflictError)
      })

      it("successfully accepts a valid pending invitation", async () => {
        const orgId = await ensureCreatedOrg()
        // Ensure testUserB is not currently a member of this org
        await db
          .delete(schema.member)
          .where(
            and(
              eq(schema.member.organizationId, orgId),
              eq(schema.member.userId, testUserB.id),
            ),
          )

        // Create a test session for testUserB
        const [testSessionB] = await db
          .insert(schema.session)
          .values({
            userId: testUserB.id,
            token: `test-token-b-${Date.now()}`,
            expiresAt: new Date(Date.now() + 1000 * 60 * 60),
          })
          .returning()

        const acceptResult = await acceptInvitation(
          testUserB.id,
          testSessionB.id,
          testUserB.email,
          { invitationId: acceptInviteId },
        )

        expect(acceptResult.success).toBe(true)
        expect(acceptResult.organizationId).toBe(orgId)

        // Verify membership created
        const [newMember] = await db
          .select()
          .from(schema.member)
          .where(
            and(
              eq(schema.member.organizationId, orgId),
              eq(schema.member.userId, testUserB.id),
            ),
          )
        expect(newMember).toBeDefined()
        expect(newMember.role).toBe("member")

        // Verify invitation marked as accepted
        const [updatedInvite] = await db
          .select()
          .from(schema.invitation)
          .where(eq(schema.invitation.id, acceptInviteId))
        expect(updatedInvite.status).toBe("accepted")

        // Verify active organization preference updated
        const [activePref] = await db
          .select()
          .from(schema.userActiveOrganization)
          .where(eq(schema.userActiveOrganization.userId, testUserB.id))
        expect(activePref?.organizationId).toBe(orgId)

        // Verify session activeOrganizationId updated
        const [updatedSession] = await db
          .select()
          .from(schema.session)
          .where(eq(schema.session.id, testSessionB.id))
        expect(updatedSession?.activeOrganizationId).toBe(orgId)

        // Idempotent re-acceptance by the same accepted user succeeds cleanly
        const reAcceptResult = await acceptInvitation(
          testUserB.id,
          testSessionB.id,
          testUserB.email,
          {
            invitationId: acceptInviteId,
          },
        )
        expect(reAcceptResult.success).toBe(true)
        expect(reAcceptResult.organizationId).toBe(orgId)

        // If testUserB is removed from membership and tries to accept the already-accepted invitation, it throws ConflictError
        await db
          .delete(schema.member)
          .where(
            and(
              eq(schema.member.organizationId, orgId),
              eq(schema.member.userId, testUserB.id),
            ),
          )
        await expect(
          acceptInvitation(testUserB.id, null, testUserB.email, {
            invitationId: acceptInviteId,
          }),
        ).rejects.toThrow(ConflictError)

        // Another user attempting to accept this invitation fails with ForbiddenError (email mismatch)
        await expect(
          acceptInvitation(testUserC.id, null, testUserC.email, {
            invitationId: acceptInviteId,
          }),
        ).rejects.toThrow(ForbiddenError)
      })

      it("rejects unverified user with ForbiddenError", async () => {
        const orgId = await ensureCreatedOrg()
        const [unverifiedUser] = await db
          .insert(schema.user)
          .values({
            name: "Unverified User",
            email: "unverified@example.com",
            emailVerified: false,
          })
          .returning()

        const invite = await inviteMember(testUserA.id, testUserA.name, {
          organizationId: orgId,
          email: "unverified@example.com",
          role: "member",
        })

        await expect(
          acceptInvitation(unverifiedUser.id, null, "unverified@example.com", {
            invitationId: invite.invitation.id,
          }),
        ).rejects.toThrow(ForbiddenError)
      })

      it("handles concurrent duplicate acceptance safely via idempotency", async () => {
        const orgId = await ensureCreatedOrg()
        const invite = await inviteMember(testUserA.id, testUserA.name, {
          organizationId: orgId,
          email: testUserD.email,
          role: "member",
        })

        // Remove any prior membership for testUserD
        await db
          .delete(schema.member)
          .where(
            and(
              eq(schema.member.organizationId, orgId),
              eq(schema.member.userId, testUserD.id),
            ),
          )

        const [res1, res2] = await Promise.all([
          acceptInvitation(testUserD.id, null, testUserD.email, {
            invitationId: invite.invitation.id,
          }),
          acceptInvitation(testUserD.id, null, testUserD.email, {
            invitationId: invite.invitation.id,
          }),
        ])

        expect(res1.success).toBe(true)
        expect(res2.success).toBe(true)
      })
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

    it("invitationDetailsQueryOptions handles valid and invalid IDs safely", () => {
      const opts = invitationDetailsQueryOptions(
        "018f1a1a-0000-7000-8000-000000000001",
      )
      expect([...opts.queryKey]).toEqual([
        "organizations",
        "invitation-details",
        "018f1a1a-0000-7000-8000-000000000001",
      ])
      expect(opts.enabled).toBe(true)

      const emptyOpts = invitationDetailsQueryOptions("")
      expect(emptyOpts.enabled).toBe(false)
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
      expect(invalidatedKeys.length).toBe(5)
      expect(invalidatedKeys).toContainEqual(["organizations"])
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

  describe("Workspace settings and membership lifecycle", () => {
    it("allows only the owner to update organization settings", async () => {
      const orgId = await ensureCreatedOrg()
      const updated = await updateOrganization(testUserA.id, {
        organizationId: orgId,
        name: "Acme Laboratories Updated",
        slug: "acme-labs-updated",
        logo: null,
      })

      expect(updated.name).toBe("Acme Laboratories Updated")
      expect(updated.slug).toBe("acme-labs-updated")

      await expect(
        updateOrganization(testUserB.id, {
          organizationId: orgId,
          name: "Unauthorized",
          slug: "unauthorized-org",
          logo: null,
        }),
      ).rejects.toThrow(ForbiddenError)
    })

    it("prevents the sole owner from leaving and removes a regular member", async () => {
      const org = await createOrganization(testUserA.id, testSessionA.id, {
        name: "Leave Lifecycle",
        slug: "leave-lifecycle",
      })

      await db.insert(schema.member).values({
        organizationId: org.id,
        userId: testUserB.id,
        role: "member",
      })

      await expect(
        leaveOrganization(testUserA.id, { organizationId: org.id }),
      ).rejects.toThrow(ForbiddenError)

      await expect(
        leaveOrganization(testUserB.id, { organizationId: org.id }),
      ).resolves.toEqual({ success: true })

      const remaining = await db
        .select()
        .from(schema.member)
        .where(eq(schema.member.organizationId, org.id))
      expect(remaining).toHaveLength(1)

      await deleteOrganization(testUserA.id, { organizationId: org.id })
    })

    it("allows the owner to delete an organization but rejects members", async () => {
      const org = await createOrganization(testUserA.id, testSessionA.id, {
        name: "Delete Lifecycle",
        slug: "delete-lifecycle",
      })

      await expect(
        deleteOrganization(testUserB.id, { organizationId: org.id }),
      ).rejects.toThrow(ForbiddenError)

      await expect(
        deleteOrganization(testUserA.id, { organizationId: org.id }),
      ).resolves.toEqual({ success: true })

      const deleted = await db.query.organization.findFirst({
        where: eq(schema.organization.id, org.id),
      })
      expect(deleted).toBeUndefined()
    })
  })
})
