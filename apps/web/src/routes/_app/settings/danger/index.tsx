import { createFileRoute } from "@tanstack/react-router"

import { OrganizationSettings } from "@/features/organizations"

export const Route = createFileRoute("/_app/settings/danger/")({
  component: DangerSettingsRoute,
})

function DangerSettingsRoute() {
  const { session, activeOrganization } = Route.useRouteContext()

  return (
    <OrganizationSettings
      activeOrganization={activeOrganization}
      currentUserId={session.user.id}
      section="danger"
    />
  )
}
