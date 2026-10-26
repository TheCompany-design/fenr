import { createFileRoute } from "@tanstack/react-router"

import {
  TenantProviderSettings,
  tenantProvidersQueryOptions,
} from "@/features/nabu"

export const Route = createFileRoute("/_app/settings/provider/")({
  loader: async ({ context }) => {
    const activeOrg = context.activeOrganization
    if (activeOrg) {
      await context.queryClient.ensureQueryData(tenantProvidersQueryOptions())
    }
  },
  component: ProviderSettingsRoute,
})

function ProviderSettingsRoute() {
  const { activeOrganization } = Route.useRouteContext()
  const role = activeOrganization.role

  return (
    <TenantProviderSettings
      canAdminister={role === "owner" || role === "admin"}
    />
  )
}
