import { createFileRoute } from "@tanstack/react-router"

import {
  TenantProviderSettings,
  tenantProviderQueryOptions,
} from "@/features/nabu"

export const Route = createFileRoute("/_app/settings/provider/")({
  loader: async ({ context }) => {
    const activeOrg = context.activeOrganization
    if (activeOrg) {
      // Prefetched so the section paints with what is already stored rather than
      // flashing an empty form before the first read lands.
      await context.queryClient.ensureQueryData(tenantProviderQueryOptions())
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
