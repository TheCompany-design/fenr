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

import { moduleLogger } from "@/lib/logger"
import {
  clearActiveOrganizationPreference,
  isValidUuid,
  resolveUserActiveOrganization,
  setActiveOrganizationPreference,
} from "@/lib/organizations/resolver"
import {
  type CreateOrganizationInput,
  isReservedSlug,
  isValidSlugFormat,
  normalizeSlug,
  type OrganizationMembershipInput,
  type SetActiveOrganizationInput,
  type UpdateOrganizationInput,
} from "@/lib/schemas/organizations"
import type { AppOrganizationAccess } from "../types"
import {
  ConflictError,
  ForbiddenError,
  isUniqueConstraintError,
  NotFoundError,
} from "./errors"

const log = moduleLogger("organizations")

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
