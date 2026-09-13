/**
 * Active organization resolver and preference management.
 *
 * SERVER-ONLY: provides resolution of active organization following the core invariant:
 * 1. Stored user preference in `user_active_organization` (if still a valid member)
 * 2. Auto-selection if user belongs to exactly one organization
 * 3. Null (prompting chooser/onboarding) if user belongs to 0 or >1 orgs without valid preference.
 */
import { and, db, eq, schema, sql } from "@workspace/database"

import { moduleLogger } from "../logger"

const log = moduleLogger("active-org")

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isValidUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_REGEX.test(value)
}

export type ActiveOrgResolution =
  | {
      organizationId: string
      status: "preference" | "single_membership"
    }
  | {
      organizationId: null
      status: "no_organizations" | "multiple_organizations_no_preference"
      count: number
    }

/**
 * Resolve the appropriate active organization for a given user.
 */
export async function resolveUserActiveOrganization(
  userId: string,
): Promise<ActiveOrgResolution> {
  if (!isValidUuid(userId)) {
    return {
      organizationId: null,
      status: "no_organizations",
      count: 0,
    }
  }

  // Parallel fetch: retrieve user's memberships and stored preference concurrently
  const [memberships, [preference]] = await Promise.all([
    db
      .select({ organizationId: schema.member.organizationId })
      .from(schema.member)
      .innerJoin(
        schema.organization,
        eq(schema.member.organizationId, schema.organization.id),
      )
      .where(eq(schema.member.userId, userId)),
    db
      .select({ organizationId: schema.userActiveOrganization.organizationId })
      .from(schema.userActiveOrganization)
      .where(eq(schema.userActiveOrganization.userId, userId))
      .limit(1),
  ])

  // 1. If stored preference exists, check if user is still an active member
  if (preference?.organizationId) {
    const isStillMember = memberships.some(
      (m) => m.organizationId === preference.organizationId,
    )

    if (isStillMember) {
      return {
        organizationId: preference.organizationId,
        status: "preference",
      }
    }

    // Stale preference: clean it up atomically targeting only the stale organizationId
    try {
      await db
        .delete(schema.userActiveOrganization)
        .where(
          and(
            eq(schema.userActiveOrganization.userId, userId),
            eq(
              schema.userActiveOrganization.organizationId,
              preference.organizationId,
            ),
          ),
        )
    } catch (err) {
      log.warn(
        { err, userId, staleOrgId: preference.organizationId },
        "failed to clean up stale active organization preference",
      )
    }
  }

  // 2. Fall back to evaluating active memberships
  if (memberships.length === 1) {
    const orgId = memberships[0].organizationId
    // Auto-select single membership and record preference
    try {
      await setActiveOrganizationPreference(userId, orgId)
    } catch (err) {
      log.warn(
        { err, userId, orgId },
        "failed to persist auto-selected active organization preference",
      )
    }

    return {
      organizationId: orgId,
      status: "single_membership",
    }
  }

  if (memberships.length === 0) {
    return {
      organizationId: null,
      status: "no_organizations",
      count: 0,
    }
  }

  return {
    organizationId: null,
    status: "multiple_organizations_no_preference",
    count: memberships.length,
  }
}

/**
 * Persist user active organization preference to `user_active_organization`.
 * Enforces that user must be a member of the organization and uses monotonic timestamp ordering.
 */
export async function setActiveOrganizationPreference(
  userId: string,
  organizationId: string,
  updatedAt: Date = new Date(),
): Promise<void> {
  if (!isValidUuid(userId) || !isValidUuid(organizationId)) {
    throw new Error(
      `Invalid userId or organizationId format: must be valid UUID strings`,
    )
  }

  // Invariant verification: ensure user is a valid member of the target organization
  const [membership] = await db
    .select({ id: schema.member.id })
    .from(schema.member)
    .where(
      and(
        eq(schema.member.userId, userId),
        eq(schema.member.organizationId, organizationId),
      ),
    )
    .limit(1)

  if (!membership) {
    throw new Error(
      `Cannot set active organization: user ${userId} is not a member of organization ${organizationId}`,
    )
  }

  await db
    .insert(schema.userActiveOrganization)
    .values({
      userId,
      organizationId,
      updatedAt,
    })
    .onConflictDoUpdate({
      target: schema.userActiveOrganization.userId,
      set: {
        organizationId,
        updatedAt,
      },
      where: sql`${schema.userActiveOrganization.updatedAt} <= excluded.updated_at`,
    })

  log.info(
    { userId, organizationId },
    "user active organization preference updated",
  )
}

/**
 * Clear the user active organization preference.
 */
export async function clearActiveOrganizationPreference(
  userId: string,
  organizationId?: string,
): Promise<void> {
  if (!isValidUuid(userId)) return

  if (organizationId !== undefined && !isValidUuid(organizationId)) {
    throw new Error(
      "Invalid organizationId format: must be a valid UUID string",
    )
  }

  const whereClause =
    organizationId === undefined
      ? eq(schema.userActiveOrganization.userId, userId)
      : and(
          eq(schema.userActiveOrganization.userId, userId),
          eq(schema.userActiveOrganization.organizationId, organizationId),
        )

  await db.delete(schema.userActiveOrganization).where(whereClause)

  log.info(
    { userId, organizationId },
    "user active organization preference cleared",
  )
}
