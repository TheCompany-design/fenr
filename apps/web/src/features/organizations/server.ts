/**
 * Server functions and domain operations for organization management and authorization.
 *
 * SERVER-ONLY: Enforces membership and permission invariants at every boundary.
 * - Defense-in-depth: caller must have a valid session (via ensureSession).
 * - Organization isolation: operations verify caller belongs to target org.
 * - Role-based authorization: admin/owner checks for mutations.
 * - Sole owner protection: sole remaining owner cannot be demoted or removed.
 * - Stale preference cleanup: removing a member clears their active org preference.
 */

import { createServerFn } from "@tanstack/react-start"
import { and, count, db, desc, eq, inArray, schema } from "@workspace/database"

import { serverEnv } from "@/lib/env"
import { moduleLogger } from "@/lib/logger"
import { maskEmail, sendOrganizationInvitationEmail } from "@/lib/mail"
import {
  clearActiveOrganizationPreference,
  resolveUserActiveOrganization,
  setActiveOrganizationPreference,
} from "@/lib/organizations/resolver"
import { ensureSession } from "@/lib/session"
import {
  type CancelInvitationInput,
  type CheckSlugInput,
  type CreateOrganizationInput,
  cancelInvitationSchema,
  checkSlugSchema,
  createOrganizationSchema,
  type GetOrganizationInvitationsInput,
  type GetOrganizationMembersInput,
  getOrganizationInvitationsSchema,
  getOrganizationMembersSchema,
  type InviteMemberInput,
  inviteMemberSchema,
  isReservedSlug,
  isValidSlugFormat,
  normalizeSlug,
  type RemoveMemberInput,
  removeMemberSchema,
  type SetActiveOrganizationInput,
  setActiveOrganizationSchema,
  type UpdateMemberRoleInput,
  updateMemberRoleSchema,
} from "./schemas"

const log = moduleLogger("organizations")

export class ForbiddenError extends Error {
  constructor(message = "You do not have permission to perform this action") {
    super(message)
    this.name = "ForbiddenError"
  }
}

export class NotFoundError extends Error {
  constructor(message = "Resource not found") {
    super(message)
    this.name = "NotFoundError"
  }
}

export class ConflictError extends Error {
  constructor(message = "Resource already exists") {
    super(message)
    this.name = "ConflictError"
  }
}

function isUniqueConstraintError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false
  const anyErr = err as Record<string, unknown>
  const code =
    anyErr.code ?? (anyErr.cause as Record<string, unknown> | undefined)?.code
  if (code === "23505") return true
  const msg = String(anyErr.message ?? "").toLowerCase()
  return (
    msg.includes("duplicate key") ||
    msg.includes("23505") ||
    msg.includes("unique constraint")
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Core Domain Operations (directly callable and testable)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check whether an organization slug is valid and available.
 */
export async function checkSlugAvailability(input: CheckSlugInput) {
  const normalized = normalizeSlug(input.slug)

  if (!isValidSlugFormat(normalized)) {
    return {
      available: false,
      slug: normalized,
      reason:
        "Slug must be between 3 and 48 alphanumeric characters or hyphens",
    }
  }

  if (isReservedSlug(normalized)) {
    return {
      available: false,
      slug: normalized,
      reason: "This slug is reserved and cannot be used",
    }
  }

  const [existing] = await db
    .select({ id: schema.organization.id })
    .from(schema.organization)
    .where(eq(schema.organization.slug, normalized))
    .limit(1)

  return {
    available: !existing,
    slug: normalized,
    reason: existing ? "This slug is already taken" : undefined,
  }
}

/**
 * List all organizations the user belongs to.
 */
export async function listOrganizations(
  userId: string,
  activeOrgId?: string | null,
) {
  const memberships = await db
    .select({
      id: schema.organization.id,
      name: schema.organization.name,
      slug: schema.organization.slug,
      logo: schema.organization.logo,
      createdAt: schema.organization.createdAt,
      role: schema.member.role,
      memberId: schema.member.id,
      joinedAt: schema.member.createdAt,
    })
    .from(schema.member)
    .innerJoin(
      schema.organization,
      eq(schema.member.organizationId, schema.organization.id),
    )
    .where(eq(schema.member.userId, userId))
    .orderBy(desc(schema.member.createdAt))

  if (memberships.length === 0) {
    return []
  }

  const orgIds = memberships.map((m) => m.id)
  const counts = await db
    .select({
      organizationId: schema.member.organizationId,
      count: count(schema.member.id),
    })
    .from(schema.member)
    .where(inArray(schema.member.organizationId, orgIds))
    .groupBy(schema.member.organizationId)

  const countMap = new Map<string, number>()
  for (const c of counts) {
    countMap.set(c.organizationId, Number(c.count))
  }

  return memberships.map((m) => ({
    ...m,
    memberCount: countMap.get(m.id) ?? 1,
    isActive: m.id === activeOrgId,
  }))
}

/**
 * Get active organization details and caller's role.
 */
export async function getActiveOrganization(
  userId: string,
  currentSessionActiveOrgId?: string | null,
) {
  let activeOrgId = currentSessionActiveOrgId
  if (!activeOrgId) {
    const resolved = await resolveUserActiveOrganization(userId)
    if (resolved.organizationId) {
      activeOrgId = resolved.organizationId
    }
  }

  if (!activeOrgId) {
    return null
  }

  const [membership] = await db
    .select({
      role: schema.member.role,
      joinedAt: schema.member.createdAt,
      organization: {
        id: schema.organization.id,
        name: schema.organization.name,
        slug: schema.organization.slug,
        logo: schema.organization.logo,
        createdAt: schema.organization.createdAt,
      },
    })
    .from(schema.member)
    .innerJoin(
      schema.organization,
      eq(schema.member.organizationId, schema.organization.id),
    )
    .where(
      and(
        eq(schema.member.userId, userId),
        eq(schema.member.organizationId, activeOrgId),
      ),
    )
    .limit(1)

  if (!membership) {
    if (currentSessionActiveOrgId) {
      await db
        .update(schema.session)
        .set({ activeOrganizationId: null, updatedAt: new Date() })
        .where(
          and(
            eq(schema.session.userId, userId),
            eq(schema.session.activeOrganizationId, currentSessionActiveOrgId),
          ),
        )

      await clearActiveOrganizationPreference(userId, currentSessionActiveOrgId)

      const resolved = await resolveUserActiveOrganization(userId)
      if (resolved.organizationId) {
        return getActiveOrganization(userId, resolved.organizationId)
      }
      return null
    }

    await clearActiveOrganizationPreference(userId, activeOrgId)
    return null
  }

  const [memberCountResult] = await db
    .select({ count: count(schema.member.id) })
    .from(schema.member)
    .where(eq(schema.member.organizationId, activeOrgId))

  return {
    organization: membership.organization,
    role: membership.role,
    joinedAt: membership.joinedAt,
    memberCount: Number(memberCountResult?.count ?? 1),
  }
}

/**
 * Create a new organization, assigning caller as owner and setting active preference.
 */
export async function createOrganization(
  userId: string,
  sessionId: string | null | undefined,
  data: CreateOrganizationInput,
) {
  const slug = normalizeSlug(data.slug)

  if (!isValidSlugFormat(slug) || isReservedSlug(slug)) {
    throw new ConflictError("Invalid or reserved organization slug")
  }

  const [existingSlug] = await db
    .select({ id: schema.organization.id })
    .from(schema.organization)
    .where(eq(schema.organization.slug, slug))
    .limit(1)

  if (existingSlug) {
    throw new ConflictError("Organization with this slug already exists")
  }

  let createdOrg: typeof schema.organization.$inferSelect
  try {
    createdOrg = await db.transaction(async (tx) => {
      const [org] = await tx
        .insert(schema.organization)
        .values({
          name: data.name.trim(),
          slug,
          logo: data.logo ?? null,
        })
        .returning()

      if (!org) {
        throw new Error("Failed to insert organization")
      }

      await tx.insert(schema.member).values({
        organizationId: org.id,
        userId,
        role: "owner",
      })

      await tx
        .insert(schema.userActiveOrganization)
        .values({
          userId,
          organizationId: org.id,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: schema.userActiveOrganization.userId,
          set: {
            organizationId: org.id,
            updatedAt: new Date(),
          },
        })

      return org
    })
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      throw new ConflictError("Organization with this slug already exists")
    }
    throw err
  }

  if (sessionId) {
    try {
      await db
        .update(schema.session)
        .set({
          activeOrganizationId: createdOrg.id,
          updatedAt: new Date(),
        })
        .where(eq(schema.session.id, sessionId))
    } catch (err) {
      log.warn(
        { err, sessionId, orgId: createdOrg.id },
        "failed to update activeOrganizationId on session record after org creation",
      )
    }
  }

  log.info(
    { userId, orgId: createdOrg.id, slug: createdOrg.slug },
    "organization created",
  )

  return createdOrg
}

/**
 * Set active organization for the current user and session.
 */
export async function setActiveOrganization(
  userId: string,
  sessionId: string | null | undefined,
  data: SetActiveOrganizationInput,
) {
  const targetOrgId = data.organizationId

  const [membership] = await db
    .select({ id: schema.member.id })
    .from(schema.member)
    .where(
      and(
        eq(schema.member.userId, userId),
        eq(schema.member.organizationId, targetOrgId),
      ),
    )
    .limit(1)

  if (!membership) {
    throw new ForbiddenError(
      "You are not an active member of this organization",
    )
  }

  await setActiveOrganizationPreference(userId, targetOrgId)

  if (sessionId) {
    await db
      .update(schema.session)
      .set({
        activeOrganizationId: targetOrgId,
        updatedAt: new Date(),
      })
      .where(eq(schema.session.id, sessionId))
  }

  log.info(
    { userId, sessionId, orgId: targetOrgId },
    "active organization changed",
  )

  return { success: true, organizationId: targetOrgId }
}

/**
 * Get members of an organization.
 */
export async function getOrganizationMembers(
  userId: string,
  data: GetOrganizationMembersInput,
) {
  const orgId = data.organizationId

  const [callerMembership] = await db
    .select({ role: schema.member.role })
    .from(schema.member)
    .where(
      and(
        eq(schema.member.userId, userId),
        eq(schema.member.organizationId, orgId),
      ),
    )
    .limit(1)

  if (!callerMembership) {
    throw new ForbiddenError(
      "You do not have access to view members of this organization",
    )
  }

  const members = await db
    .select({
      id: schema.member.id,
      userId: schema.member.userId,
      role: schema.member.role,
      createdAt: schema.member.createdAt,
      user: {
        id: schema.user.id,
        name: schema.user.name,
        email: schema.user.email,
        image: schema.user.image,
      },
    })
    .from(schema.member)
    .innerJoin(schema.user, eq(schema.member.userId, schema.user.id))
    .where(eq(schema.member.organizationId, orgId))
    .orderBy(desc(schema.member.createdAt))

  return {
    callerRole: callerMembership.role,
    members,
  }
}

/**
 * Get pending invitations for an organization (owner/admin only).
 */
export async function getOrganizationInvitations(
  userId: string,
  data: GetOrganizationInvitationsInput,
) {
  const orgId = data.organizationId

  const [callerMembership] = await db
    .select({ role: schema.member.role })
    .from(schema.member)
    .where(
      and(
        eq(schema.member.userId, userId),
        eq(schema.member.organizationId, orgId),
      ),
    )
    .limit(1)

  if (
    !callerMembership ||
    (callerMembership.role !== "owner" && callerMembership.role !== "admin")
  ) {
    throw new ForbiddenError(
      "Only organization owners and admins can view invitations",
    )
  }

  const invitations = await db
    .select({
      id: schema.invitation.id,
      email: schema.invitation.email,
      role: schema.invitation.role,
      status: schema.invitation.status,
      expiresAt: schema.invitation.expiresAt,
      createdAt: schema.invitation.createdAt,
      inviterName: schema.user.name,
    })
    .from(schema.invitation)
    .leftJoin(schema.user, eq(schema.invitation.inviterId, schema.user.id))
    .where(
      and(
        eq(schema.invitation.organizationId, orgId),
        eq(schema.invitation.status, "pending"),
      ),
    )
    .orderBy(desc(schema.invitation.createdAt))

  return invitations
}

/**
 * Invite a member to the organization (owner/admin only).
 */
export async function inviteMember(
  userId: string,
  userName: string | null | undefined,
  data: InviteMemberInput,
) {
  const { organizationId, email, role } = data

  const [callerMembership] = await db
    .select({
      role: schema.member.role,
      organizationName: schema.organization.name,
    })
    .from(schema.member)
    .innerJoin(
      schema.organization,
      eq(schema.member.organizationId, schema.organization.id),
    )
    .where(
      and(
        eq(schema.member.userId, userId),
        eq(schema.member.organizationId, organizationId),
      ),
    )
    .limit(1)

  if (
    !callerMembership ||
    (callerMembership.role !== "owner" && callerMembership.role !== "admin")
  ) {
    throw new ForbiddenError(
      "Only organization owners and admins can invite members",
    )
  }

  if (role === "owner" && callerMembership.role !== "owner") {
    throw new ForbiddenError("Only organization owners can invite new owners")
  }
  if (callerMembership.role !== "owner" && role !== "member") {
    throw new ForbiddenError("Admins can only invite regular members")
  }

  const [existingMember] = await db
    .select({ id: schema.member.id })
    .from(schema.member)
    .innerJoin(schema.user, eq(schema.member.userId, schema.user.id))
    .where(
      and(
        eq(schema.member.organizationId, organizationId),
        eq(schema.user.email, email),
      ),
    )
    .limit(1)

  if (existingMember) {
    throw new ConflictError(
      "A user with this email address is already a member of this organization",
    )
  }

  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000)

  const [existingInvite] = await db
    .select({ id: schema.invitation.id })
    .from(schema.invitation)
    .where(
      and(
        eq(schema.invitation.organizationId, organizationId),
        eq(schema.invitation.email, email),
        eq(schema.invitation.status, "pending"),
      ),
    )
    .limit(1)

  let invitationRecord: typeof schema.invitation.$inferSelect

  try {
    if (existingInvite) {
      const [updated] = await db
        .update(schema.invitation)
        .set({
          role,
          expiresAt,
          inviterId: userId,
        })
        .where(eq(schema.invitation.id, existingInvite.id))
        .returning()

      if (!updated) throw new Error("Failed to update invitation")
      invitationRecord = updated
    } else {
      const [created] = await db
        .insert(schema.invitation)
        .values({
          organizationId,
          email,
          role,
          status: "pending",
          inviterId: userId,
          expiresAt,
        })
        .returning()

      if (!created) throw new Error("Failed to create invitation")
      invitationRecord = created
    }
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      throw new ConflictError(
        "An invitation for this email already exists in this organization",
      )
    }
    throw err
  }

  const baseUrl = serverEnv.BETTER_AUTH_URL.replace(/\/+$/, "")
  const acceptUrl = `${baseUrl}/invitations/accept?id=${encodeURIComponent(invitationRecord.id)}`
  const inviterName = userName || "A team member"

  let emailSent = false
  try {
    await sendOrganizationInvitationEmail({
      to: email,
      organizationName: callerMembership.organizationName,
      inviterName,
      role,
      acceptUrl,
      expiresInHours: 48,
    })
    emailSent = true
  } catch (err) {
    log.error(
      {
        err,
        email: maskEmail(email),
        orgId: organizationId,
        invitationId: invitationRecord.id,
      },
      "failed to dispatch invitation email",
    )
  }

  log.info(
    {
      orgId: organizationId,
      email: maskEmail(email),
      role,
      inviterId: userId,
      emailSent,
    },
    "organization invitation created",
  )

  return { invitation: invitationRecord, emailSent }
}

/**
 * Cancel a pending invitation (owner/admin only).
 */
export async function cancelInvitation(
  userId: string,
  data: CancelInvitationInput,
) {
  const { organizationId, invitationId } = data

  const [callerMembership] = await db
    .select({ role: schema.member.role })
    .from(schema.member)
    .where(
      and(
        eq(schema.member.userId, userId),
        eq(schema.member.organizationId, organizationId),
      ),
    )
    .limit(1)

  if (
    !callerMembership ||
    (callerMembership.role !== "owner" && callerMembership.role !== "admin")
  ) {
    throw new ForbiddenError(
      "Only organization owners and admins can cancel invitations",
    )
  }

  const [deleted] = await db
    .delete(schema.invitation)
    .where(
      and(
        eq(schema.invitation.id, invitationId),
        eq(schema.invitation.organizationId, organizationId),
      ),
    )
    .returning()

  if (!deleted) {
    throw new NotFoundError("Invitation not found")
  }

  return { success: true }
}

/**
 * Update a member's role (owner only).
 * Invariant: Cannot demote the sole remaining owner.
 */
export async function updateMemberRole(
  userId: string,
  data: UpdateMemberRoleInput,
) {
  const { organizationId, memberId, role } = data

  return await db.transaction(async (tx) => {
    await tx
      .select({ id: schema.organization.id })
      .from(schema.organization)
      .where(eq(schema.organization.id, organizationId))
      .for("update")

    const [callerMembership] = await tx
      .select({ role: schema.member.role })
      .from(schema.member)
      .where(
        and(
          eq(schema.member.userId, userId),
          eq(schema.member.organizationId, organizationId),
        ),
      )
      .limit(1)

    if (callerMembership?.role !== "owner") {
      throw new ForbiddenError(
        "Only organization owners can change member roles",
      )
    }

    const [targetMember] = await tx
      .select({ id: schema.member.id, role: schema.member.role })
      .from(schema.member)
      .where(
        and(
          eq(schema.member.id, memberId),
          eq(schema.member.organizationId, organizationId),
        ),
      )
      .limit(1)

    if (!targetMember) {
      throw new NotFoundError("Member not found")
    }

    if (targetMember.role === "owner" && role !== "owner") {
      const [ownerCountResult] = await tx
        .select({ count: count(schema.member.id) })
        .from(schema.member)
        .where(
          and(
            eq(schema.member.organizationId, organizationId),
            eq(schema.member.role, "owner"),
          ),
        )

      if (Number(ownerCountResult?.count ?? 0) <= 1) {
        throw new ForbiddenError(
          "Cannot demote the sole owner of the organization. Transfer ownership first.",
        )
      }
    }

    await tx
      .update(schema.member)
      .set({ role })
      .where(eq(schema.member.id, memberId))

    log.info(
      { orgId: organizationId, memberId, newRole: role, updatedBy: userId },
      "member role updated",
    )

    return { success: true, memberId, role }
  })
}

/**
 * Remove a member from an organization.
 * Invariants:
 * - Caller must be owner, or admin (removing regular member), or self-removal.
 * - Cannot remove the sole remaining owner.
 * - If removed member had this org as active preference, clear it.
 */
export async function removeMember(userId: string, data: RemoveMemberInput) {
  const { organizationId, memberId } = data

  const removedTarget = await db.transaction(async (tx) => {
    await tx
      .select({ id: schema.organization.id })
      .from(schema.organization)
      .where(eq(schema.organization.id, organizationId))
      .for("update")

    const [targetMember] = await tx
      .select({
        id: schema.member.id,
        userId: schema.member.userId,
        role: schema.member.role,
      })
      .from(schema.member)
      .where(
        and(
          eq(schema.member.id, memberId),
          eq(schema.member.organizationId, organizationId),
        ),
      )
      .limit(1)

    if (!targetMember) {
      throw new NotFoundError("Member not found")
    }

    const [callerMembership] = await tx
      .select({ role: schema.member.role })
      .from(schema.member)
      .where(
        and(
          eq(schema.member.userId, userId),
          eq(schema.member.organizationId, organizationId),
        ),
      )
      .limit(1)

    if (!callerMembership) {
      throw new ForbiddenError("You are not a member of this organization")
    }

    const isSelfRemoval = targetMember.userId === userId
    const isOwner = callerMembership.role === "owner"
    const isAdmin = callerMembership.role === "admin"

    if (!isSelfRemoval && !isOwner) {
      if (!isAdmin || targetMember.role !== "member") {
        throw new ForbiddenError("Admins can only remove regular members")
      }
    }

    if (targetMember.role === "owner") {
      const [ownerCountResult] = await tx
        .select({ count: count(schema.member.id) })
        .from(schema.member)
        .where(
          and(
            eq(schema.member.organizationId, organizationId),
            eq(schema.member.role, "owner"),
          ),
        )

      if (Number(ownerCountResult?.count ?? 0) <= 1) {
        throw new ForbiddenError(
          "Cannot remove the sole owner of the organization. Transfer ownership or delete the organization.",
        )
      }
    }

    await tx.delete(schema.member).where(eq(schema.member.id, memberId))

    return targetMember
  })

  try {
    await db
      .update(schema.session)
      .set({ activeOrganizationId: null, updatedAt: new Date() })
      .where(
        and(
          eq(schema.session.userId, removedTarget.userId),
          eq(schema.session.activeOrganizationId, organizationId),
        ),
      )
  } catch (err) {
    log.warn(
      { err, userId: removedTarget.userId, orgId: organizationId },
      "failed to clear session active organization after member removal",
    )
  }

  try {
    await clearActiveOrganizationPreference(
      removedTarget.userId,
      organizationId,
    )
  } catch (err) {
    log.warn(
      { err, userId: removedTarget.userId, orgId: organizationId },
      "failed to clear active organization preference after member removal",
    )
  }

  log.info(
    {
      orgId: organizationId,
      memberId,
      removedUserId: removedTarget.userId,
      removedBy: userId,
    },
    "member removed from organization",
  )

  return { success: true }
}

// ─────────────────────────────────────────────────────────────────────────────
// TanStack Start createServerFn Endpoints
// ─────────────────────────────────────────────────────────────────────────────

export const listOrganizationsFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const session = await ensureSession()
    return listOrganizations(
      session.user.id,
      session.session.activeOrganizationId,
    )
  },
)

export const getActiveOrganizationFn = createServerFn({
  method: "GET",
}).handler(async () => {
  const session = await ensureSession()
  return getActiveOrganization(
    session.user.id,
    session.session.activeOrganizationId,
  )
})

export const checkSlugAvailabilityFn = createServerFn({ method: "GET" })
  .validator((input: unknown): CheckSlugInput => checkSlugSchema.parse(input))
  .handler(async ({ data }) => {
    return checkSlugAvailability(data)
  })

export const createOrganizationFn = createServerFn({ method: "POST" })
  .validator(
    (input: unknown): CreateOrganizationInput =>
      createOrganizationSchema.parse(input),
  )
  .handler(async ({ data }) => {
    const session = await ensureSession()
    return createOrganization(session.user.id, session.session.id, data)
  })

export const setActiveOrganizationFn = createServerFn({ method: "POST" })
  .validator(
    (input: unknown): SetActiveOrganizationInput =>
      setActiveOrganizationSchema.parse(input),
  )
  .handler(async ({ data }) => {
    const session = await ensureSession()
    return setActiveOrganization(session.user.id, session.session.id, data)
  })

export const getOrganizationMembersFn = createServerFn({ method: "GET" })
  .validator(
    (input: unknown): GetOrganizationMembersInput =>
      getOrganizationMembersSchema.parse(input),
  )
  .handler(async ({ data }) => {
    const session = await ensureSession()
    return getOrganizationMembers(session.user.id, data)
  })

export const getOrganizationInvitationsFn = createServerFn({ method: "GET" })
  .validator(
    (input: unknown): GetOrganizationInvitationsInput =>
      getOrganizationInvitationsSchema.parse(input),
  )
  .handler(async ({ data }) => {
    const session = await ensureSession()
    return getOrganizationInvitations(session.user.id, data)
  })

export const inviteMemberFn = createServerFn({ method: "POST" })
  .validator(
    (input: unknown): InviteMemberInput => inviteMemberSchema.parse(input),
  )
  .handler(async ({ data }) => {
    const session = await ensureSession()
    return inviteMember(session.user.id, session.user.name, data)
  })

export const cancelInvitationFn = createServerFn({ method: "POST" })
  .validator(
    (input: unknown): CancelInvitationInput =>
      cancelInvitationSchema.parse(input),
  )
  .handler(async ({ data }) => {
    const session = await ensureSession()
    return cancelInvitation(session.user.id, data)
  })

export const updateMemberRoleFn = createServerFn({ method: "POST" })
  .validator(
    (input: unknown): UpdateMemberRoleInput =>
      updateMemberRoleSchema.parse(input),
  )
  .handler(async ({ data }) => {
    const session = await ensureSession()
    return updateMemberRole(session.user.id, data)
  })

export const removeMemberFn = createServerFn({ method: "POST" })
  .validator(
    (input: unknown): RemoveMemberInput => removeMemberSchema.parse(input),
  )
  .handler(async ({ data }) => {
    const session = await ensureSession()
    return removeMember(session.user.id, data)
  })
