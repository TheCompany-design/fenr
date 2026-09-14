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

import {
  and,
  count,
  db,
  desc,
  eq,
  inArray,
  lte,
  schema,
} from "@workspace/database"

import { serverEnv } from "@/lib/env"
import { moduleLogger } from "@/lib/logger"
import { maskEmail, sendOrganizationInvitationEmail } from "@/lib/mail"
import {
  clearActiveOrganizationPreference,
  isValidUuid,
  resolveUserActiveOrganization,
  setActiveOrganizationPreference,
} from "@/lib/organizations/resolver"
import {
  type AcceptInvitationInput,
  type CancelInvitationInput,
  type CheckSlugInput,
  type CreateOrganizationInput,
  type GetOrganizationInvitationsInput,
  type GetOrganizationMembersInput,
  type InviteMemberInput,
  isReservedSlug,
  isValidSlugFormat,
  normalizeSlug,
  type OrganizationMembershipInput,
  type RemoveMemberInput,
  type SetActiveOrganizationInput,
  type UpdateMemberRoleInput,
  type UpdateOrganizationInput,
} from "./schemas"
import type {
  ActiveOrganization,
  AppOrganizationAccess,
  InvitationDetailsResult,
} from "./types"

export type {
  ActiveOrganization,
  AppOrganizationAccess,
  InvitationDetailsResult,
}

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
  if (!isValidUuid(userId)) {
    return null
  }

  let activeOrgId =
    currentSessionActiveOrgId && isValidUuid(currentSessionActiveOrgId)
      ? currentSessionActiveOrgId
      : null

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
      if (
        resolved.organizationId &&
        resolved.organizationId !== currentSessionActiveOrgId
      ) {
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
 * Resolve organization access for the authenticated app route guard.
 *
 * Invariants:
 * 1. If an active organization is already selected and valid for this user/session,
 *    returns { status: "authorized", activeOrganization }.
 * 2. If no valid active organization is selected:
 *    - If user belongs to 0 organizations: returns { status: "no_organizations" }.
 *    - If user belongs to 1 organization: auto-selected by getActiveOrganization, returns { status: "authorized", activeOrganization }.
 *    - If user belongs to >1 organizations with no preference: returns { status: "choose_organization", count }.
 */
export async function resolveAppOrganizationAccess(
  userId: string,
  currentSessionActiveOrgId?: string | null,
): Promise<AppOrganizationAccess> {
  const activeOrganization = await getActiveOrganization(
    userId,
    currentSessionActiveOrgId,
  )

  if (activeOrganization) {
    return {
      status: "authorized",
      activeOrganization,
    }
  }

  const resolution = await resolveUserActiveOrganization(userId)

  if (resolution.status === "no_organizations") {
    return { status: "no_organizations" }
  }

  if (resolution.status === "multiple_organizations_no_preference") {
    return {
      status: "choose_organization",
      count: resolution.count,
    }
  }

  if (resolution.organizationId) {
    const fallbackActive = await getActiveOrganization(
      userId,
      resolution.organizationId,
    )
    if (fallbackActive) {
      return {
        status: "authorized",
        activeOrganization: fallbackActive,
      }
    }
  }

  return { status: "no_organizations" }
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
        .where(
          and(
            eq(schema.session.id, sessionId),
            eq(schema.session.userId, userId),
          ),
        )
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

export async function updateOrganization(
  userId: string,
  data: UpdateOrganizationInput,
) {
  try {
    return await db.transaction(async (tx) => {
      const [callerMembership] = await tx
        .select({ role: schema.member.role })
        .from(schema.member)
        .where(
          and(
            eq(schema.member.userId, userId),
            eq(schema.member.organizationId, data.organizationId),
          ),
        )
        .limit(1)

      if (callerMembership?.role !== "owner") {
        throw new ForbiddenError("Only organization owners can edit settings")
      }

      const [updated] = await tx
        .update(schema.organization)
        .set({
          name: data.name.trim(),
          slug: data.slug,
          logo: data.logo ?? null,
        })
        .where(eq(schema.organization.id, data.organizationId))
        .returning()

      if (!updated) throw new NotFoundError("Organization not found")
      log.info(
        { userId, organizationId: data.organizationId, slug: updated.slug },
        "organization settings updated",
      )
      return updated
    })
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      throw new ConflictError("Organization with this slug already exists")
    }
    throw err
  }
}

export async function leaveOrganization(
  userId: string,
  data: OrganizationMembershipInput,
) {
  const removed = await db.transaction(async (tx) => {
    await tx
      .select({ id: schema.organization.id })
      .from(schema.organization)
      .where(eq(schema.organization.id, data.organizationId))
      .for("update")

    const [membership] = await tx
      .select({ id: schema.member.id, role: schema.member.role })
      .from(schema.member)
      .where(
        and(
          eq(schema.member.userId, userId),
          eq(schema.member.organizationId, data.organizationId),
        ),
      )
      .limit(1)

    if (!membership)
      throw new NotFoundError("Organization membership not found")
    if (membership.role === "owner") {
      const [ownerCount] = await tx
        .select({ count: count(schema.member.id) })
        .from(schema.member)
        .where(
          and(
            eq(schema.member.organizationId, data.organizationId),
            eq(schema.member.role, "owner"),
          ),
        )
      if (Number(ownerCount?.count ?? 0) <= 1) {
        throw new ForbiddenError(
          "The sole owner cannot leave. Transfer ownership or delete the organization.",
        )
      }
    }

    await tx.delete(schema.member).where(eq(schema.member.id, membership.id))
    return membership
  })

  try {
    await clearActiveOrganizationPreference(userId, data.organizationId)
    await db
      .update(schema.session)
      .set({ activeOrganizationId: null, updatedAt: new Date() })
      .where(
        and(
          eq(schema.session.userId, userId),
          eq(schema.session.activeOrganizationId, data.organizationId),
        ),
      )
  } catch (cleanupErr) {
    log.warn(
      { err: cleanupErr, userId, organizationId: data.organizationId },
      "Membership left but active organization cleanup failed",
    )
  }
  log.info(
    { userId, organizationId: data.organizationId, role: removed.role },
    "organization membership left",
  )
  return { success: true }
}

export async function deleteOrganization(
  userId: string,
  data: OrganizationMembershipInput,
) {
  await db.transaction(async (tx) => {
    const [membership] = await tx
      .select({ role: schema.member.role })
      .from(schema.member)
      .where(
        and(
          eq(schema.member.userId, userId),
          eq(schema.member.organizationId, data.organizationId),
        ),
      )
      .limit(1)
    if (membership?.role !== "owner") {
      throw new ForbiddenError("Only organization owners can delete it")
    }
    const [deleted] = await tx
      .delete(schema.organization)
      .where(eq(schema.organization.id, data.organizationId))
      .returning({ id: schema.organization.id })
    if (!deleted) throw new NotFoundError("Organization not found")
  })

  try {
    await clearActiveOrganizationPreference(userId, data.organizationId)
    await db
      .update(schema.session)
      .set({ activeOrganizationId: null, updatedAt: new Date() })
      .where(
        and(
          eq(schema.session.userId, userId),
          eq(schema.session.activeOrganizationId, data.organizationId),
        ),
      )
  } catch (cleanupErr) {
    log.warn(
      { err: cleanupErr, userId, organizationId: data.organizationId },
      "Organization deleted but active organization cleanup failed",
    )
  }
  log.info(
    { userId, organizationId: data.organizationId },
    "organization deleted",
  )
  return { success: true }
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

  const now = new Date()
  await setActiveOrganizationPreference(userId, targetOrgId, now)

  if (sessionId) {
    await db
      .update(schema.session)
      .set({
        activeOrganizationId: targetOrgId,
        updatedAt: now,
      })
      .where(
        and(
          eq(schema.session.id, sessionId),
          eq(schema.session.userId, userId),
          lte(schema.session.updatedAt, now),
        ),
      )
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
  const { organizationId, email, role, note } = data

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
      personalNote: note,
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

  const [canceled] = await db
    .update(schema.invitation)
    .set({ status: "canceled" })
    .where(
      and(
        eq(schema.invitation.id, invitationId),
        eq(schema.invitation.organizationId, organizationId),
        eq(schema.invitation.status, "pending"),
      ),
    )
    .returning()

  if (!canceled) {
    throw new NotFoundError("Invitation not found or is no longer pending")
  }

  return { success: true }
}

/**
 * Retrieve public/unauthenticated details for an invitation by ID.
 * Returns status enum so UI can render appropriate messaging without crashing.
 */
export async function getInvitationDetails(
  invitationId: string,
): Promise<InvitationDetailsResult> {
  if (!isValidUuid(invitationId)) {
    return { status: "invalid" }
  }

  const [record] = await db
    .select({
      id: schema.invitation.id,
      email: schema.invitation.email,
      role: schema.invitation.role,
      status: schema.invitation.status,
      expiresAt: schema.invitation.expiresAt,
      createdAt: schema.invitation.createdAt,
      organizationId: schema.organization.id,
      organizationName: schema.organization.name,
      organizationSlug: schema.organization.slug,
      organizationLogo: schema.organization.logo,
      inviterName: schema.user.name,
    })
    .from(schema.invitation)
    .innerJoin(
      schema.organization,
      eq(schema.invitation.organizationId, schema.organization.id),
    )
    .innerJoin(schema.user, eq(schema.invitation.inviterId, schema.user.id))
    .where(eq(schema.invitation.id, invitationId))
    .limit(1)

  if (!record) {
    return { status: "not_found" }
  }

  const isExpired = record.expiresAt < new Date()
  let computedStatus: "valid" | "expired" | "accepted" | "canceled" | "invalid"

  if (record.status === "accepted") {
    computedStatus = "accepted"
  } else if (record.status === "canceled") {
    computedStatus = "canceled"
  } else if (record.status === "pending") {
    computedStatus = isExpired ? "expired" : "valid"
  } else {
    computedStatus = "invalid"
  }

  if (computedStatus === "invalid") {
    return { status: "invalid" }
  }

  return {
    status: computedStatus,
    invitation: {
      id: record.id,
      email: record.email,
      role: record.role,
      organizationId: record.organizationId,
      organizationName: record.organizationName,
      organizationSlug: record.organizationSlug,
      organizationLogo: record.organizationLogo,
      inviterName: record.inviterName || "A team member",
      expiresAt: record.expiresAt,
      createdAt: record.createdAt,
    },
  }
}

/**
 * Accept an invitation for the authenticated caller.
 *
 * Invariants:
 * 1. Caller email must match invitation email (case-insensitive).
 * 2. Caller email must be verified.
 * 3. Invitation must be in pending status and not expired.
 * 4. Adds user to organization with specified role.
 * 5. Marks invitation as accepted.
 * 6. Automatically updates active organization preference and session.
 * 7. Idempotent on repeated calls by the same accepted user.
 */
export async function acceptInvitation(
  userId: string,
  sessionId: string | null | undefined,
  userEmail: string,
  data: AcceptInvitationInput,
) {
  const { invitationId } = data
  if (!isValidUuid(invitationId)) {
    throw new NotFoundError("Invalid invitation ID")
  }

  return await db.transaction(async (tx) => {
    // 1. Lock invitation row
    const [invitationRecord] = await tx
      .select({
        id: schema.invitation.id,
        organizationId: schema.invitation.organizationId,
        email: schema.invitation.email,
        role: schema.invitation.role,
        status: schema.invitation.status,
        expiresAt: schema.invitation.expiresAt,
      })
      .from(schema.invitation)
      .where(eq(schema.invitation.id, invitationId))
      .for("update")

    if (!invitationRecord) {
      throw new NotFoundError("Invitation not found")
    }

    // 2. Strict email trust boundary & email verification
    const [userRecord] = await tx
      .select({
        email: schema.user.email,
        emailVerified: schema.user.emailVerified,
      })
      .from(schema.user)
      .where(eq(schema.user.id, userId))
      .limit(1)

    if (!userRecord?.emailVerified) {
      throw new ForbiddenError(
        "You must verify your email address before accepting this invitation",
      )
    }

    if (
      userRecord.email.trim().toLowerCase() !==
      invitationRecord.email.trim().toLowerCase()
    ) {
      throw new ForbiddenError(
        "Signed-in user email does not match invitation email",
      )
    }

    // 3. Status checks & Idempotency
    if (invitationRecord.status === "accepted") {
      const [membership] = await tx
        .select({ id: schema.member.id })
        .from(schema.member)
        .where(
          and(
            eq(schema.member.organizationId, invitationRecord.organizationId),
            eq(schema.member.userId, userId),
          ),
        )
        .limit(1)

      if (membership) {
        if (sessionId) {
          await tx
            .update(schema.session)
            .set({
              activeOrganizationId: invitationRecord.organizationId,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(schema.session.id, sessionId),
                eq(schema.session.userId, userId),
              ),
            )
        }
        return {
          success: true,
          organizationId: invitationRecord.organizationId,
        }
      }

      throw new ConflictError("This invitation has already been accepted")
    }

    if (invitationRecord.status === "canceled") {
      throw new ConflictError("This invitation has been canceled")
    }

    if (invitationRecord.status !== "pending") {
      throw new ConflictError("This invitation is no longer pending")
    }

    if (invitationRecord.expiresAt < new Date()) {
      throw new ConflictError("This invitation has expired")
    }

    // 4. Add user as member if not already a member
    await tx
      .insert(schema.member)
      .values({
        organizationId: invitationRecord.organizationId,
        userId,
        role: invitationRecord.role,
      })
      .onConflictDoNothing()

    // 5. Mark invitation as accepted
    await tx
      .update(schema.invitation)
      .set({ status: "accepted" })
      .where(eq(schema.invitation.id, invitationRecord.id))

    // 6. Update active organization preference
    await tx
      .insert(schema.userActiveOrganization)
      .values({
        userId,
        organizationId: invitationRecord.organizationId,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: schema.userActiveOrganization.userId,
        set: {
          organizationId: invitationRecord.organizationId,
          updatedAt: new Date(),
        },
      })

    // 7. Update session activeOrganizationId
    if (sessionId) {
      await tx
        .update(schema.session)
        .set({
          activeOrganizationId: invitationRecord.organizationId,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(schema.session.id, sessionId),
            eq(schema.session.userId, userId),
          ),
        )
    }

    log.info(
      {
        userId,
        email: maskEmail(userEmail),
        orgId: invitationRecord.organizationId,
        invitationId,
        role: invitationRecord.role,
      },
      "invitation accepted",
    )

    return {
      success: true,
      organizationId: invitationRecord.organizationId,
    }
  })
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
