import { createFileRoute } from "@tanstack/react-router"
import { integrationsCatalogQueryOptions } from "@/features/integrations/api/integrations-queries"
import { IntegrationsDirectory } from "@/features/integrations/components/integrations-directory"
import { IntegrationDetailSheet } from "@/features/integrations/components/sheet/integration-detail-sheet"

export const Route = createFileRoute("/_app/integrations/")({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(integrationsCatalogQueryOptions())
  },
  component: IntegrationsPage,
})

function IntegrationsPage() {
  const context = Route.useRouteContext()
  const role = context.activeOrganization?.role ?? "member"
  const isAdmin = role === "owner" || role === "admin"

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <IntegrationsDirectory isAdmin={isAdmin} />
      <IntegrationDetailSheet isAdmin={isAdmin} />
    </div>
  )
}
