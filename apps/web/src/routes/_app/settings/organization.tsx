/**
 * /settings/organization — Organization workspace settings, teammate invites, and member management.
 *
 * Runs under the _app guard layout, ensuring a valid authenticated session
 * and an active organization are present in route context.
 */
import { createFileRoute } from "@tanstack/react-router"

import {
  OrganizationSettings,
  organizationInvitationsQueryOptions,
  organizationMembersQueryOptions,
} from "@/features/organizations"

export const Route = createFileRoute("/_app/settings/organization")({
  loader: async ({ context }) => {
    const activeOrg = context.activeOrganization
    if (activeOrg) {
      await Promise.all([
        context.queryClient.ensureQueryData(
          organizationMembersQueryOptions(activeOrg.organization.id),
        ),
        activeOrg.role === "owner" || activeOrg.role === "admin"
          ? context.queryClient.ensureQueryData(
              organizationInvitationsQueryOptions(activeOrg.organization.id),
            )
          : Promise.resolve(),
      ])
    }
  },
  component: OrganizationSettingsRoute,
})

function OrganizationSettingsRoute() {
  const { session, activeOrganization } = Route.useRouteContext()

  return (
    <div className="flex-1 p-6 lg:p-8">
      <OrganizationSettings
        activeOrganization={activeOrganization}
        currentUserId={session.user.id}
      />
    </div>
  )
}
