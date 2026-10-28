import { RefreshIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import { Switch } from "@workspace/ui/components/switch"
import { toast } from "sonner"
import { updateToolkitConfigFn } from "@/features/integrations/api/integrations.functions"
import {
  integrationsCatalogQueryOptions,
  toolkitConnectionState,
} from "@/features/integrations/api/integrations-queries"
import { IntegrationBrandLogo } from "@/features/integrations/components/integration-brand-logo"

export const Route = createFileRoute("/_app/settings/integrations")({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(integrationsCatalogQueryOptions())
  },
  component: SettingsIntegrationsPage,
})

function SettingsIntegrationsPage() {
  const { data: catalog } = useQuery(integrationsCatalogQueryOptions())
  const queryClient = useQueryClient()

  const context = Route.useRouteContext()
  const isAdmin =
    context.activeOrganization?.role === "owner" ||
    context.activeOrganization?.role === "admin"

  const installed = (catalog?.toolkits ?? []).filter(
    (toolkit) =>
      toolkit.config !== null &&
      toolkitConnectionState(toolkit) !== "available",
  )

  const toggle = useMutation({
    mutationFn: (input: { toolkitSlug: string; enabled: boolean }) =>
      updateToolkitConfigFn({
        data: {
          toolkitSlug: input.toolkitSlug,
          enabledForAgents: input.enabled,
        },
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: integrationsCatalogQueryOptions().queryKey,
      }),
    onError: (error) => {
      toast.error("Couldn't update the integration", {
        description: error instanceof Error ? error.message : undefined,
      })
    },
  })

  return (
    <ScrollArea className="h-full">
      <div className="grid max-w-3xl gap-6 p-6">
        <header className="grid gap-1">
          <h2 className="text-lg font-semibold tracking-tight">
            Your Integrations
          </h2>
          <p className="text-sm text-muted-foreground">
            Installed integrations and whether agents may use them in this
            workspace.
          </p>
        </header>

        {installed.map((toolkit) => (
          <div
            key={toolkit.slug}
            className="rounded-xl border border-border/60 bg-card p-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="flex size-11 items-center justify-center rounded-lg border border-border/60 bg-muted/40">
                  <IntegrationBrandLogo
                    slug={toolkit.logo_slug}
                    monochrome={toolkit.logo_monochrome}
                    size={24}
                  />
                </span>
                <div className="grid gap-0.5">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    {toolkit.display_name}
                    {toolkit.is_new && (
                      <Badge variant="secondary" className="text-[10px]">
                        NEW
                      </Badge>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    By {toolkit.vendor_name}
                  </p>
                </div>
              </div>
              {isAdmin && (
                <Switch
                  checked={toolkit.config?.enabled_for_agents ?? false}
                  disabled={toggle.isPending}
                  onCheckedChange={(enabled) =>
                    toggle.mutate({ toolkitSlug: toolkit.slug, enabled })
                  }
                />
              )}
            </div>
            <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
              {toolkit.short_description}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="text-[10px]">
                {toolkit.setup_steps_count} STEPS
              </Badge>
              {toolkit.connections.some((account) =>
                ["expired", "needs_reauth", "error"].includes(account.status),
              ) && (
                <Badge variant="destructive" className="text-[10px]">
                  CONNECTION ERROR
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto"
                onClick={() => {
                  window.location.href = `/integrations?app=${toolkit.slug}`
                }}
              >
                <HugeiconsIcon icon={RefreshIcon} size={14} />
                View instructions
              </Button>
            </div>
          </div>
        ))}

        {installed.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No integrations installed yet. Browse the{" "}
            <a className="text-primary underline" href="/integrations">
              integrations directory
            </a>{" "}
            to connect your team's tools.
          </p>
        )}
      </div>
    </ScrollArea>
  )
}
