import { and, db, desc, eq, schema } from "@workspace/database"

import { serverEnv } from "@/lib/env"
import { moduleLogger } from "@/lib/logger"
import { maskEmail, sendOrganizationInvitationEmail } from "@/lib/mail"
import { isValidUuid } from "@/lib/organizations/resolver"
import type {
  AcceptInvitationInput,
  CancelInvitationInput,
  GetOrganizationInvitationsInput,
  InviteMemberInput,
} from "@/lib/schemas/organizations"
import type { InvitationDetailsResult } from "../types"
import {
  ConflictError,
  ForbiddenError,
  isUniqueConstraintError,
  NotFoundError,
} from "./errors"

const log = moduleLogger("organizations")

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
        .where(
          and(
            eq(schema.invitation.id, existingInvite.id),
            eq(schema.invitation.status, "pending"),
          ),
        )
        .returning()

      if (!updated) {
        throw new ConflictError("Invitation is no longer pending")
      }
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
