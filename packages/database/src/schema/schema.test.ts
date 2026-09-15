import { afterAll, beforeAll, describe, expect, it } from "bun:test"
import { and, eq } from "drizzle-orm"
import { db } from "../index"
import * as schema from "./index"

async function cleanTestData() {
  await db.delete(schema.userActiveOrganization)
  await db.delete(schema.invitation)
  await db.delete(schema.member)
  await db.delete(schema.session)
  await db.delete(schema.account)
  await db.delete(schema.verification)
  await db.delete(schema.organization)
  await db.delete(schema.user)
}

describe("Schema & Database Architecture", () => {
  beforeAll(async () => {
    await cleanTestData()
  })

  afterAll(async () => {
    await cleanTestData()
  })

  describe("Native Postgres 18 UUIDv7 idColumn helper", () => {
    it("idColumn helper constructs uuid primaryKey with default uuidv7()", () => {
      const userTable = schema.user
      expect(userTable.id.name).toBe("id")
      expect(userTable.id.primary).toBe(true)
      expect(userTable.id.notNull).toBe(true)
      expect(userTable.id.dataType).toBe("string")
    })
  })

  describe("Barrel exports", () => {
    it("exports all tables, relations, and helpers", () => {
      // Tables
      expect(schema.user).toBeDefined()
      expect(schema.session).toBeDefined()
      expect(schema.account).toBeDefined()
      expect(schema.verification).toBeDefined()
      expect(schema.organization).toBeDefined()
      expect(schema.member).toBeDefined()
      expect(schema.invitation).toBeDefined()
      expect(schema.userActiveOrganization).toBeDefined()

      // Relations
      expect(schema.userRelations).toBeDefined()
      expect(schema.sessionRelations).toBeDefined()
      expect(schema.accountRelations).toBeDefined()
      expect(schema.organizationRelations).toBeDefined()
      expect(schema.memberRelations).toBeDefined()
      expect(schema.invitationRelations).toBeDefined()
      expect(schema.userActiveOrganizationRelations).toBeDefined()

      // Helpers
      expect(schema.idColumn).toBeDefined()
    })
  })

  describe("Schema column definitions and contracts", () => {
    it("matches Better Auth and Fenr column requirements for all tables", () => {
      // user
      expect(schema.user.id).toBeDefined()
      expect(schema.user.name).toBeDefined()
      expect(schema.user.email).toBeDefined()
      expect(schema.user.emailVerified).toBeDefined()
      expect(schema.user.image).toBeDefined()
      expect(schema.user.createdAt).toBeDefined()
      expect(schema.user.updatedAt).toBeDefined()

      // session
      expect(schema.session.id).toBeDefined()
      expect(schema.session.expiresAt).toBeDefined()
      expect(schema.session.token).toBeDefined()
      expect(schema.session.createdAt).toBeDefined()
      expect(schema.session.updatedAt).toBeDefined()
      expect(schema.session.ipAddress).toBeDefined()
      expect(schema.session.userAgent).toBeDefined()
      expect(schema.session.userId).toBeDefined()
      expect(schema.session.activeOrganizationId).toBeDefined()

      // account
      expect(schema.account.id).toBeDefined()
      expect(schema.account.issuer).toBeDefined()
      expect(schema.account.accountId).toBeDefined()
      expect(schema.account.providerId).toBeDefined()
      expect(schema.account.userId).toBeDefined()
      expect(schema.account.accessToken).toBeDefined()
      expect(schema.account.refreshToken).toBeDefined()
      expect(schema.account.idToken).toBeDefined()
      expect(schema.account.accessTokenExpiresAt).toBeDefined()
      expect(schema.account.refreshTokenExpiresAt).toBeDefined()
      expect(schema.account.scope).toBeDefined()
      expect(schema.account.password).toBeDefined()
      expect(schema.account.createdAt).toBeDefined()
      expect(schema.account.updatedAt).toBeDefined()

      // verification
      expect(schema.verification.id).toBeDefined()
      expect(schema.verification.identifier).toBeDefined()
      expect(schema.verification.value).toBeDefined()
      expect(schema.verification.expiresAt).toBeDefined()
      expect(schema.verification.createdAt).toBeDefined()
      expect(schema.verification.updatedAt).toBeDefined()

      // organization
      expect(schema.organization.id).toBeDefined()
      expect(schema.organization.name).toBeDefined()
      expect(schema.organization.slug).toBeDefined()
      expect(schema.organization.logo).toBeDefined()
      expect(schema.organization.metadata).toBeDefined()
      expect(schema.organization.createdAt).toBeDefined()
      expect(schema.organization.updatedAt).toBeDefined()

      // member
      expect(schema.member.id).toBeDefined()
      expect(schema.member.organizationId).toBeDefined()
      expect(schema.member.userId).toBeDefined()
      expect(schema.member.role).toBeDefined()
      expect(schema.member.createdAt).toBeDefined()

      // invitation
      expect(schema.invitation.id).toBeDefined()
      expect(schema.invitation.organizationId).toBeDefined()
      expect(schema.invitation.email).toBeDefined()
      expect(schema.invitation.role).toBeDefined()
      expect(schema.invitation.status).toBeDefined()
      expect(schema.invitation.teamId).toBeDefined()
      expect(schema.invitation.inviterId).toBeDefined()
      expect(schema.invitation.expiresAt).toBeDefined()
      expect(schema.invitation.createdAt).toBeDefined()

      // userActiveOrganization
      expect(schema.userActiveOrganization.userId).toBeDefined()
      expect(schema.userActiveOrganization.organizationId).toBeDefined()
      expect(schema.userActiveOrganization.updatedAt).toBeDefined()
    })
  })

  describe("Database CRUD & relational queries", () => {
    it("inserts and queries records with auto-generated Postgres UUIDv7 IDs", async () => {
      // Insert user without providing explicit id
      const [insertedUser] = await db
        .insert(schema.user)
        .values({
          name: "Alice Tester",
          email: "alice@example.com",
        })
        .returning()

      expect(insertedUser.id).toBeDefined()
      expect(insertedUser.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      )
      expect(insertedUser.name).toBe("Alice Tester")
      expect(insertedUser.emailVerified).toBe(false)

      // Insert organization
      const [insertedOrg] = await db
        .insert(schema.organization)
        .values({
          name: "Acme Corp",
          slug: "acme-corp",
        })
        .returning()

      expect(insertedOrg.id).toBeDefined()
      expect(insertedOrg.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      )
      expect(insertedOrg.slug).toBe("acme-corp")

      // Insert session with activeOrganizationId
      const [insertedSession] = await db
        .insert(schema.session)
        .values({
          userId: insertedUser.id,
          token: "session-token-123",
          expiresAt: new Date(Date.now() + 3600 * 1000),
          activeOrganizationId: insertedOrg.id,
        })
        .returning()

      expect(insertedSession.id).toBeDefined()
      expect(insertedSession.userId).toBe(insertedUser.id)
      expect(insertedSession.activeOrganizationId).toBe(insertedOrg.id)

      // Insert member
      const [insertedMember] = await db
        .insert(schema.member)
        .values({
          organizationId: insertedOrg.id,
          userId: insertedUser.id,
          role: "owner",
        })
        .returning()

      expect(insertedMember.id).toBeDefined()
      expect(insertedMember.role).toBe("owner")

      // Insert invitation
      const [insertedInvitation] = await db
        .insert(schema.invitation)
        .values({
          organizationId: insertedOrg.id,
          email: "bob@example.com",
          role: "member",
          inviterId: insertedUser.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
        })
        .returning()

      expect(insertedInvitation.id).toBeDefined()
      expect(insertedInvitation.status).toBe("pending")
      expect(insertedInvitation.inviterId).toBe(insertedUser.id)

      // Insert userActiveOrganization preference
      const [insertedPref] = await db
        .insert(schema.userActiveOrganization)
        .values({
          userId: insertedUser.id,
          organizationId: insertedOrg.id,
        })
        .returning()

      expect(insertedPref.userId).toBe(insertedUser.id)
      expect(insertedPref.organizationId).toBe(insertedOrg.id)

      // Insert account
      const [insertedAccount] = await db
        .insert(schema.account)
        .values({
          issuer: "local:credential",
          accountId: "alice-account",
          providerId: "credential",
          userId: insertedUser.id,
          password: "hashed_password",
        })
        .returning()

      expect(insertedAccount.id).toBeDefined()
      expect(insertedAccount.issuer).toBe("local:credential")

      // Insert verification
      const [insertedVerification] = await db
        .insert(schema.verification)
        .values({
          identifier: "alice@example.com",
          value: "token_abc123",
          expiresAt: new Date(Date.now() + 900 * 1000),
        })
        .returning()

      expect(insertedVerification.id).toBeDefined()
      expect(insertedVerification.identifier).toBe("alice@example.com")

      // Relational queries
      const userWithRelations = await db.query.user.findFirst({
        where: eq(schema.user.id, insertedUser.id),
        with: {
          sessions: true,
          accounts: true,
          members: true,
          sentInvitations: true,
          activeOrganizationPreference: true,
        },
      })

      expect(userWithRelations).toBeDefined()
      expect(userWithRelations?.sessions.length).toBe(1)
      expect(userWithRelations?.sessions[0].id).toBe(insertedSession.id)
      expect(userWithRelations?.accounts.length).toBe(1)
      expect(userWithRelations?.members.length).toBe(1)
      expect(userWithRelations?.sentInvitations.length).toBe(1)
      expect(
        userWithRelations?.activeOrganizationPreference?.organizationId,
      ).toBe(insertedOrg.id)

      const sessionWithRelations = await db.query.session.findFirst({
        where: eq(schema.session.id, insertedSession.id),
        with: {
          user: true,
          activeOrganization: true,
        },
      })

      expect(sessionWithRelations?.user.name).toBe("Alice Tester")
      expect(sessionWithRelations?.activeOrganization?.name).toBe("Acme Corp")

      const orgWithRelations = await db.query.organization.findFirst({
        where: eq(schema.organization.id, insertedOrg.id),
        with: {
          members: {
            with: {
              user: true,
            },
          },
          invitations: {
            with: {
              inviter: true,
            },
          },
          sessions: true,
        },
      })

      expect(orgWithRelations?.members.length).toBe(1)
      expect(orgWithRelations?.members[0].user.name).toBe("Alice Tester")
      expect(orgWithRelations?.invitations.length).toBe(1)
      expect(orgWithRelations?.invitations[0].inviter.name).toBe("Alice Tester")
      expect(orgWithRelations?.sessions.length).toBe(1)
    })

    it("enforces unique constraints", async () => {
      // Ensure baseline records exist for uniqueness checks
      const [existingUser] = await db
        .insert(schema.user)
        .values({
          name: "Alice Tester",
          email: "alice@example.com",
        })
        .onConflictDoUpdate({
          target: schema.user.email,
          set: { name: "Alice Tester" },
        })
        .returning()

      const [existingOrg] = await db
        .insert(schema.organization)
        .values({
          name: "Acme Corp",
          slug: "acme-corp",
        })
        .onConflictDoUpdate({
          target: schema.organization.slug,
          set: { name: "Acme Corp" },
        })
        .returning()

      await db
        .insert(schema.member)
        .values({
          organizationId: existingOrg.id,
          userId: existingUser.id,
          role: "owner",
        })
        .onConflictDoNothing()

      await db
        .insert(schema.account)
        .values({
          issuer: "local:credential",
          accountId: "alice-account",
          providerId: "credential",
          userId: existingUser.id,
          password: "hashed_password",
        })
        .onConflictDoNothing()

      // Unique user email
      let userEmailError: unknown = null
      try {
        await db.insert(schema.user).values({
          name: "Alice Clone",
          email: "alice@example.com",
        })
      } catch (err) {
        userEmailError = err
      }
      expect(userEmailError).not.toBeNull()

      // Unique organization slug
      let orgSlugError: unknown = null
      try {
        await db.insert(schema.organization).values({
          name: "Acme Clone",
          slug: "acme-corp",
        })
      } catch (err) {
        orgSlugError = err
      }
      expect(orgSlugError).not.toBeNull()

      // Unique member (organizationId, userId)

      let memberError: unknown = null
      try {
        await db.insert(schema.member).values({
          organizationId: existingOrg.id,
          userId: existingUser.id,
          role: "admin",
        })
      } catch (err) {
        memberError = err
      }
      expect(memberError).not.toBeNull()

      // Unique account (issuer, accountId)
      let accountError: unknown = null
      try {
        await db.insert(schema.account).values({
          issuer: "local:credential",
          accountId: "alice-account",
          providerId: "credential",
          userId: existingUser.id,
        })
      } catch (err) {
        accountError = err
      }
      expect(accountError).not.toBeNull()

      // Partial unique invitation (organizationId, email) WHERE status = 'pending'
      const existingPendingInvite = await db.query.invitation.findFirst({
        where: and(
          eq(schema.invitation.organizationId, existingOrg.id),
          eq(schema.invitation.email, "bob@example.com"),
          eq(schema.invitation.status, "pending"),
        ),
      })
      if (!existingPendingInvite) {
        await db.insert(schema.invitation).values({
          organizationId: existingOrg.id,
          email: "bob@example.com",
          role: "member",
          inviterId: existingUser.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
          status: "pending",
        })
      }

      let duplicatePendingInviteError: unknown = null
      try {
        await db.insert(schema.invitation).values({
          organizationId: existingOrg.id,
          email: "bob@example.com",
          role: "admin",
          inviterId: existingUser.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
          status: "pending",
        })
      } catch (err) {
        duplicatePendingInviteError = err
      }
      expect(duplicatePendingInviteError).not.toBeNull()

      // Non-pending status should allow another record for the same email
      const [acceptedInvitation] = await db
        .insert(schema.invitation)
        .values({
          organizationId: existingOrg.id,
          email: "bob@example.com",
          role: "member",
          inviterId: existingUser.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
          status: "accepted",
        })
        .returning()
      expect(acceptedInvitation.id).toBeDefined()
      expect(acceptedInvitation.status).toBe("accepted")
    })

    it("handles cascade deletion and on delete set null", async () => {
      // Create user 2 and org 2
      const [user2] = await db
        .insert(schema.user)
        .values({
          name: "User Two",
          email: "user2@example.com",
        })
        .returning()

      const [org2] = await db
        .insert(schema.organization)
        .values({
          name: "Org Two",
          slug: "org-two",
        })
        .returning()

      const [session2] = await db
        .insert(schema.session)
        .values({
          userId: user2.id,
          token: "token-user2",
          expiresAt: new Date(Date.now() + 3600 * 1000),
          activeOrganizationId: org2.id,
        })
        .returning()

      const [account2] = await db
        .insert(schema.account)
        .values({
          issuer: "local:credential",
          accountId: "user2-account",
          providerId: "credential",
          userId: user2.id,
        })
        .returning()

      await db.insert(schema.member).values({
        organizationId: org2.id,
        userId: user2.id,
        role: "owner",
      })

      const [_invitation2] = await db
        .insert(schema.invitation)
        .values({
          organizationId: org2.id,
          email: "charlie@example.com",
          role: "member",
          inviterId: user2.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
        })
        .returning()

      await db.insert(schema.userActiveOrganization).values({
        userId: user2.id,
        organizationId: org2.id,
      })

      // Deleting org2 should:
      // 1. Set session2.activeOrganizationId to null (on delete set null)
      // 2. Cascade delete member record
      // 3. Cascade delete userActiveOrganization record
      // 4. Cascade delete invitation record
      await db
        .delete(schema.organization)
        .where(eq(schema.organization.id, org2.id))

      const updatedSession = await db.query.session.findFirst({
        where: eq(schema.session.id, session2.id),
      })
      expect(updatedSession).toBeDefined()
      expect(updatedSession?.activeOrganizationId).toBeNull()

      const remainingMembers = await db.query.member.findMany({
        where: eq(schema.member.organizationId, org2.id),
      })
      expect(remainingMembers.length).toBe(0)

      const remainingPref = await db.query.userActiveOrganization.findFirst({
        where: eq(schema.userActiveOrganization.userId, user2.id),
      })
      expect(remainingPref).toBeUndefined()

      const remainingOrgInvitations = await db.query.invitation.findMany({
        where: eq(schema.invitation.organizationId, org2.id),
      })
      expect(remainingOrgInvitations.length).toBe(0)

      // Deleting user2 should cascade delete session2, account2, and userActiveOrganization
      await db.delete(schema.user).where(eq(schema.user.id, user2.id))

      const deadSession = await db.query.session.findFirst({
        where: eq(schema.session.id, session2.id),
      })
      expect(deadSession).toBeUndefined()

      const deadAccount = await db.query.account.findFirst({
        where: eq(schema.account.id, account2.id),
      })
      expect(deadAccount).toBeUndefined()
    })
  })
})
