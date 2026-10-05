import { afterAll, beforeAll, describe, expect, it } from "bun:test"
import { and, eq } from "drizzle-orm"
import { db } from "../index"
import * as schema from "./index"

async function cleanTestData() {
  const currentDbUrl = process.env.DATABASE_URL ?? ""
  if (!currentDbUrl.includes("_test")) {
    throw new Error(
      `CRITICAL SAFETY ABORT: Refusing to clean non-test database: "${currentDbUrl}". Tests must run against a database ending with '_test'.`,
    )
  }
  await db.delete(schema.agentItems)
  await db.delete(schema.agentTurns)
  await db.delete(schema.agentThreads)
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
      expect(schema.agentThreads).toBeDefined()
      expect(schema.agentTurns).toBeDefined()
      expect(schema.agentItems).toBeDefined()

      // Relations
      expect(schema.userRelations).toBeDefined()
      expect(schema.sessionRelations).toBeDefined()
      expect(schema.accountRelations).toBeDefined()
      expect(schema.organizationRelations).toBeDefined()
      expect(schema.memberRelations).toBeDefined()
      expect(schema.invitationRelations).toBeDefined()
      expect(schema.userActiveOrganizationRelations).toBeDefined()
      expect(schema.agentThreadsRelations).toBeDefined()
      expect(schema.agentTurnsRelations).toBeDefined()
      expect(schema.agentItemsRelations).toBeDefined()

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

      // agentThreads
      expect(schema.agentThreads.id).toBeDefined()
      expect(schema.agentThreads.tenantId).toBeDefined()
      expect(schema.agentThreads.title).toBeDefined()
      expect(schema.agentThreads.createdAt).toBeDefined()
      expect(schema.agentThreads.updatedAt).toBeDefined()

      // agentTurns
      expect(schema.agentTurns.id).toBeDefined()
      expect(schema.agentTurns.threadId).toBeDefined()
      expect(schema.agentTurns.turnIndex).toBeDefined()
      expect(schema.agentTurns.status).toBeDefined()
      expect(schema.agentTurns.createdAt).toBeDefined()
      expect(schema.agentTurns.completedAt).toBeDefined()

      // agentItems
      expect(schema.agentItems.id).toBeDefined()
      expect(schema.agentItems.threadId).toBeDefined()
      expect(schema.agentItems.turnId).toBeDefined()
      expect(schema.agentItems.kind).toBeDefined()
      expect(schema.agentItems.payload).toBeDefined()
      expect(schema.agentItems.createdAt).toBeDefined()
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
  })
})
