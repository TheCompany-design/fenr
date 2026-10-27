import { createFileRoute } from "@tanstack/react-router"
import { usageSummaryQueryOptions } from "@/features/nabu"
import { UsageDashboard } from "@/features/usage"

export const Route = createFileRoute("/_app/settings/usage/")({
  loader: async ({ context }) => {
    const activeOrg = context.activeOrganization
    if (activeOrg) {
      try {
        await context.queryClient.ensureQueryData(usageSummaryQueryOptions(30))
      } catch {
        // Fall back gracefully so the page component can render permissions/error state
      }
    }
  },
  component: UsageSettingsRoute,
})

function UsageSettingsRoute() {
  return <UsageDashboard />
}
