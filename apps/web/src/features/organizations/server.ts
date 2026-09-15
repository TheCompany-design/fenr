/**
 * Server functions for organization management and authorization.
 *
 * Exposes type-safe createServerFn endpoints for client consumption.
 * Domain logic is encapsulated in operations.ts and called inside .handler().
 */

import { createServerFn } from "@tanstack/react-start"

import { withWideEvent } from "@/lib/logger"
import { maskEmail } from "@/lib/mail"
import {
  type AcceptInvitationInput,
  acceptInvitationSchema,
  type CancelInvitationInput,
  type CheckSlugInput,
  type CreateOrganizationInput,
  cancelInvitationSchema,
  checkSlugSchema,
  createOrganizationSchema,
  type GetInvitationDetailsInput,
  type GetOrganizationInvitationsInput,
  type GetOrganizationMembersInput,
  getInvitationDetailsSchema,
  getOrganizationInvitationsSchema,
  getOrganizationMembersSchema,
  type InviteMemberInput,
  inviteMemberSchema,
  type OrganizationMembershipInput,
  organizationMembershipSchema,
  type RemoveMemberInput,
  removeMemberSchema,
  type SetActiveOrganizationInput,
  setActiveOrganizationSchema,
  type UpdateMemberRoleInput,
  type UpdateOrganizationInput,
  updateMemberRoleSchema,
  updateOrganizationSchema,
} from "@/lib/schemas/organizations"
import { ensureSession } from "@/lib/session"
import {
  acceptInvitation,
  cancelInvitation,
  checkSlugAvailability,
  createOrganization,
  deleteOrganization,
  getActiveOrganization,
  getInvitationDetails,
  getOrganizationInvitations,
  getOrganizationMembers,
  inviteMember,
  leaveOrganization,
  listOrganizations,
  removeMember,
  resolveAppOrganizationAccess,
  setActiveOrganization,
  updateMemberRole,
  updateOrganization,
} from "./operations"
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

export const listOrganizationsFn = createServerFn({ method: "GET" }).handler(
  async () => {
    return withWideEvent(
      "organizations",
      "listOrganizations",
      async (setContext) => {
        const session = await ensureSession()
        setContext({
          userId: session.user.id,
          organizationId: session.session.activeOrganizationId,
        })
        return listOrganizations(
          session.user.id,
          session.session.activeOrganizationId,
        )
      },
    )
  },
)

export const getActiveOrganizationFn = createServerFn({
  method: "GET",
}).handler(async () => {
  return withWideEvent(
    "organizations",
    "getActiveOrganization",
    async (setContext) => {
      const session = await ensureSession()
      setContext({
        userId: session.user.id,
        organizationId: session.session.activeOrganizationId,
      })
      return getActiveOrganization(
        session.user.id,
        session.session.activeOrganizationId,
      )
    },
  )
})

export const resolveAppOrganizationAccessFn = createServerFn({
  method: "GET",
}).handler(async (): Promise<AppOrganizationAccess> => {
  return withWideEvent(
    "organizations",
    "resolveAppOrganizationAccess",
    async (setContext) => {
      const session = await ensureSession()
      setContext({
        userId: session.user.id,
        organizationId: session.session.activeOrganizationId,
      })
      return resolveAppOrganizationAccess(
        session.user.id,
        session.session.activeOrganizationId,
      )
    },
  )
})

export const checkSlugAvailabilityFn = createServerFn({ method: "GET" })
  .validator((input: unknown): CheckSlugInput => checkSlugSchema.parse(input))
  .handler(async ({ data }) => {
    return withWideEvent(
      "organizations",
      "checkSlugAvailability",
      async (setContext) => {
        setContext({ slug: data.slug })
        return checkSlugAvailability(data)
      },
    )
  })

export const createOrganizationFn = createServerFn({ method: "POST" })
  .validator(
    (input: unknown): CreateOrganizationInput =>
      createOrganizationSchema.parse(input),
  )
  .handler(async ({ data }) => {
    return withWideEvent(
      "organizations",
      "createOrganization",
      async (setContext) => {
        const session = await ensureSession()
        setContext({ userId: session.user.id, slug: data.slug })
        const org = await createOrganization(
          session.user.id,
          session.session.id,
          data,
        )
        setContext({ organizationId: org.id })
        return org
      },
    )
  })

export const setActiveOrganizationFn = createServerFn({ method: "POST" })
  .validator(
    (input: unknown): SetActiveOrganizationInput =>
      setActiveOrganizationSchema.parse(input),
  )
  .handler(async ({ data }) => {
    return withWideEvent(
      "organizations",
      "setActiveOrganization",
      async (setContext) => {
        const session = await ensureSession()
        setContext({
          userId: session.user.id,
          organizationId: data.organizationId,
        })
        return setActiveOrganization(session.user.id, session.session.id, data)
      },
    )
  })

export const updateOrganizationFn = createServerFn({ method: "POST" })
  .validator(
    (input: unknown): UpdateOrganizationInput =>
      updateOrganizationSchema.parse(input),
  )
  .handler(async ({ data }) =>
    withWideEvent("organizations", "updateOrganization", async (setContext) => {
      const session = await ensureSession()
      setContext({
        userId: session.user.id,
        organizationId: data.organizationId,
      })
      return updateOrganization(session.user.id, data)
    }),
  )

export const leaveOrganizationFn = createServerFn({ method: "POST" })
  .validator(
    (input: unknown): OrganizationMembershipInput =>
      organizationMembershipSchema.parse(input),
  )
  .handler(async ({ data }) =>
    withWideEvent("organizations", "leaveOrganization", async (setContext) => {
      const session = await ensureSession()
      setContext({
        userId: session.user.id,
        organizationId: data.organizationId,
      })
      return leaveOrganization(session.user.id, data)
    }),
  )

export const deleteOrganizationFn = createServerFn({ method: "POST" })
  .validator(
    (input: unknown): OrganizationMembershipInput =>
      organizationMembershipSchema.parse(input),
  )
  .handler(async ({ data }) =>
    withWideEvent("organizations", "deleteOrganization", async (setContext) => {
      const session = await ensureSession()
      setContext({
        userId: session.user.id,
        organizationId: data.organizationId,
      })
      return deleteOrganization(session.user.id, data)
    }),
  )

export const getOrganizationMembersFn = createServerFn({ method: "GET" })
  .validator(
    (input: unknown): GetOrganizationMembersInput =>
      getOrganizationMembersSchema.parse(input),
  )
  .handler(async ({ data }) => {
    return withWideEvent(
      "organizations",
      "getOrganizationMembers",
      async (setContext) => {
        const session = await ensureSession()
        setContext({
          userId: session.user.id,
          organizationId: data.organizationId,
        })
        return getOrganizationMembers(session.user.id, data)
      },
    )
  })

export const getOrganizationInvitationsFn = createServerFn({ method: "GET" })
  .validator(
    (input: unknown): GetOrganizationInvitationsInput =>
      getOrganizationInvitationsSchema.parse(input),
  )
  .handler(async ({ data }) => {
    return withWideEvent(
      "organizations",
      "getOrganizationInvitations",
      async (setContext) => {
        const session = await ensureSession()
        setContext({
          userId: session.user.id,
          organizationId: data.organizationId,
        })
        return getOrganizationInvitations(session.user.id, data)
      },
    )
  })

export const inviteMemberFn = createServerFn({ method: "POST" })
  .validator(
    (input: unknown): InviteMemberInput => inviteMemberSchema.parse(input),
  )
  .handler(async ({ data }) => {
    return withWideEvent(
      "organizations",
      "inviteMember",
      async (setContext) => {
        const session = await ensureSession()
        setContext({
          userId: session.user.id,
          organizationId: data.organizationId,
          email: maskEmail(data.email),
          role: data.role,
        })
        return inviteMember(session.user.id, session.user.name, data)
      },
    )
  })

export const cancelInvitationFn = createServerFn({ method: "POST" })
  .validator(
    (input: unknown): CancelInvitationInput =>
      cancelInvitationSchema.parse(input),
  )
  .handler(async ({ data }) => {
    return withWideEvent(
      "organizations",
      "cancelInvitation",
      async (setContext) => {
        const session = await ensureSession()
        setContext({
          userId: session.user.id,
          organizationId: data.organizationId,
          invitationId: data.invitationId,
        })
        return cancelInvitation(session.user.id, data)
      },
    )
  })

export const updateMemberRoleFn = createServerFn({ method: "POST" })
  .validator(
    (input: unknown): UpdateMemberRoleInput =>
      updateMemberRoleSchema.parse(input),
  )
  .handler(async ({ data }) => {
    return withWideEvent(
      "organizations",
      "updateMemberRole",
      async (setContext) => {
        const session = await ensureSession()
        setContext({
          userId: session.user.id,
          organizationId: data.organizationId,
          targetMemberId: data.memberId,
          role: data.role,
        })
        return updateMemberRole(session.user.id, data)
      },
    )
  })

export const removeMemberFn = createServerFn({ method: "POST" })
  .validator(
    (input: unknown): RemoveMemberInput => removeMemberSchema.parse(input),
  )
  .handler(async ({ data }) => {
    return withWideEvent(
      "organizations",
      "removeMember",
      async (setContext) => {
        const session = await ensureSession()
        setContext({
          userId: session.user.id,
          organizationId: data.organizationId,
          targetMemberId: data.memberId,
        })
        return removeMember(session.user.id, data)
      },
    )
  })

export const getInvitationDetailsFn = createServerFn({ method: "GET" })
  .validator(
    (input: unknown): GetInvitationDetailsInput =>
      getInvitationDetailsSchema.parse(input),
  )
  .handler(async ({ data }) => {
    return withWideEvent(
      "organizations",
      "getInvitationDetails",
      async (setContext) => {
        setContext({ invitationId: data.invitationId })
        const details = await getInvitationDetails(data.invitationId)
        if ("invitation" in details && details.invitation) {
          setContext({ organizationId: details.invitation.organizationId })
        }
        return details
      },
    )
  })

export const acceptInvitationFn = createServerFn({ method: "POST" })
  .validator(
    (input: unknown): AcceptInvitationInput =>
      acceptInvitationSchema.parse(input),
  )
  .handler(async ({ data }) => {
    return withWideEvent(
      "organizations",
      "acceptInvitation",
      async (setContext) => {
        const session = await ensureSession()
        setContext({
          userId: session.user.id,
          invitationId: data.invitationId,
        })
        const result = await acceptInvitation(
          session.user.id,
          session.session.id,
          session.user.email,
          data,
        )
        setContext({ organizationId: result.organizationId })
        return result
      },
    )
  })
