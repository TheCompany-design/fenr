import type { QueryClient } from "@tanstack/react-query"
import { queryOptions } from "@tanstack/react-query"

import {
  checkSlugAvailabilityFn,
  getActiveOrganizationFn,
  getInvitationDetailsFn,
  getOrganizationInvitationsFn,
  getOrganizationMembersFn,
  listOrganizationsFn,
} from "./server"

export const organizationKeys = {
  all: ["organizations"] as const,
  lists: () => [...organizationKeys.all, "list"] as const,
  active: () => [...organizationKeys.all, "active"] as const,
  membersRoot: () => [...organizationKeys.all, "members"] as const,
  members: (orgId: string) =>
    [...organizationKeys.all, "members", orgId] as const,
  invitationsRoot: () => [...organizationKeys.all, "invitations"] as const,
  invitations: (orgId: string) =>
    [...organizationKeys.all, "invitations", orgId] as const,
  invitationDetails: (id: string) =>
    [...organizationKeys.all, "invitation-details", id] as const,
  slugCheck: (slug: string) =>
    [...organizationKeys.all, "slug-check", slug] as const,
}

export function organizationListQueryOptions() {
  return queryOptions({
    queryKey: organizationKeys.lists(),
    queryFn: () => listOrganizationsFn(),
    staleTime: 1000 * 60,
  })
}

export type OrganizationListItem = Awaited<
  ReturnType<typeof listOrganizationsFn>
>[number]

export function activeOrganizationQueryOptions() {
  return queryOptions({
    queryKey: organizationKeys.active(),
    queryFn: () => getActiveOrganizationFn(),
    staleTime: 0,
  })
}

export function organizationMembersQueryOptions(organizationId: string) {
  return queryOptions({
    queryKey: organizationKeys.members(organizationId),
    queryFn: () => getOrganizationMembersFn({ data: { organizationId } }),
    enabled: Boolean(organizationId),
    staleTime: 1000 * 60,
  })
}

export function organizationInvitationsQueryOptions(organizationId: string) {
  return queryOptions({
    queryKey: organizationKeys.invitations(organizationId),
    queryFn: () => getOrganizationInvitationsFn({ data: { organizationId } }),
    enabled: Boolean(organizationId),
    staleTime: 1000 * 30,
  })
}

export function invitationDetailsQueryOptions(invitationId?: string | null) {
  const trimmed = (invitationId ?? "").trim()
  return queryOptions({
    queryKey: organizationKeys.invitationDetails(trimmed),
    queryFn: () => getInvitationDetailsFn({ data: { invitationId: trimmed } }),
    enabled: Boolean(trimmed),
    staleTime: 1000 * 30,
  })
}

export function slugAvailabilityQueryOptions(slug?: string | null) {
  const trimmed = (slug ?? "").trim()
  return queryOptions({
    queryKey: organizationKeys.slugCheck(trimmed),
    queryFn: () => checkSlugAvailabilityFn({ data: { slug: trimmed } }),
    enabled: trimmed.length >= 3,
    staleTime: 1000 * 10,
  })
}

export async function invalidateOrganizationQueries(
  queryClient: QueryClient,
  _organizationId?: string,
) {
  await queryClient.invalidateQueries({ queryKey: organizationKeys.all })
}
