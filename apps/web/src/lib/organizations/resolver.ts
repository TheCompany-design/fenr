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
      .select({
        organizationId: schema.userActiveOrganization.organizationId,
        updatedAt: schema.userActiveOrganization.updatedAt,
      })
      .from(schema.userActiveOrganization)
      .where(eq(schema.userActiveOrganization.userId, userId))
      .limit(1),
  ])

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
            eq(schema.userActiveOrganization.updatedAt, preference.updatedAt),
          ),
        )
    } catch (err) {
      log.warn(
        { err, userId, staleOrgId: preference.organizationId },
        "failed to clean up stale active organization preference",
      )
    }
  }

  if (memberships.length === 1) {
    const orgId = memberships[0].organizationId

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

  await db.transaction(async (tx) => {
    const [membership] = await tx
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

    const [updated] = await tx
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
      .returning()

    if (updated) {
      log.info(
        { userId, organizationId },
        "user active organization preference updated",
      )
    } else {
      log.info(
        { userId, organizationId },
        "user active organization preference update skipped due to newer existing record",
      )
    }
  })
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
