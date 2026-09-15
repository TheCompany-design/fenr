import { and, count, db, desc, eq, schema } from "@workspace/database"

import { moduleLogger } from "@/lib/logger"
import { clearActiveOrganizationPreference } from "@/lib/organizations/resolver"
import type {
  GetOrganizationMembersInput,
  RemoveMemberInput,
  UpdateMemberRoleInput,
} from "@/lib/schemas/organizations"
import { ForbiddenError, NotFoundError } from "./errors"

const log = moduleLogger("organizations")

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

    const [callerMembership] = await tx
      .select({
        id: schema.member.id,
        role: schema.member.role,
      })
      .from(schema.member)
      .where(
        and(
          eq(schema.member.userId, userId),
          eq(schema.member.organizationId, organizationId),
        ),
      )
      .limit(1)

    if (!callerMembership) {
      throw new ForbiddenError("You do not have access to this organization")
    }

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

    const isSelf = targetMember.userId === userId
    const isOwner = callerMembership.role === "owner"
    const isAdmin = callerMembership.role === "admin"

    if (!isSelf && !isOwner && !isAdmin) {
      throw new ForbiddenError("You do not have permission to remove members")
    }

    if (!isSelf && isAdmin && targetMember.role !== "member") {
      throw new ForbiddenError(
        "Admins can only remove regular members from the organization",
      )
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
