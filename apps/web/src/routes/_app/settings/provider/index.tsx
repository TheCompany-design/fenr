import { createFileRoute } from "@tanstack/react-router"

import {
  TenantProviderSettings,
  tenantProvidersQueryOptions,
} from "@/features/nabu"

export const Route = createFileRoute("/_app/settings/provider/")({
  loader: async ({ context }) => {
    const activeOrg = context.activeOrganization
    if (activeOrg) {
      // Prefetched so the section paints with what is already stored rather than
      // flashing an empty form before the first read lands.
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
