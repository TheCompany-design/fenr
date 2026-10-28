import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Alert02Icon,
  CheckmarkBadge01Icon,
  PlusSignIcon,
  RefreshIcon,
  Search01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { parseAsString, useQueryState } from "nuqs"
import { toast } from "sonner"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import { Switch } from "@workspace/ui/components/switch"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/toggle-group"

import {
  integrationsCatalogQueryOptions,
  toolkitConnectionState,
} from "../api/integrations-queries"
import {
  deleteConnectionFn,
  updateToolkitConfigFn,
} from "../api/integrations.functions"
import { useOauthConnectFlow } from "../hooks/use-oauth-connect-flow"
import { IntegrationBrandLogo } from "./integration-brand-logo"
import { RequestIntegrationDialog } from "./request-integration-dialog"

const CATEGORY_LABELS: Record<string, string> = {
  popular: "Popular",
  google: "Google",
  communication: "Communication",
  developer_tools: "Developer & Design",
  project_management: "Project Management",
  crm_sales: "CRM & Revenue",
  ads_marketing: "Ad platforms",
  files_knowledge: "Files & Knowledge",
  finance_commerce: "Finance & Commerce",
  automation: "Automation",
}

export function IntegrationsDirectory({
  isAdmin,
}: {
  isAdmin: boolean
}) {
  const [tab, setTab] = useQueryState(
    "tab",
    parseAsString.withDefault("all"),
  )
  const [kind] = useQueryState("kind", parseAsString.withDefault("all"))
  const [query, setQuery] = useQueryState("q", parseAsString)
  const [, setOpenApp] = useQueryState("app", parseAsString)

  const { data: catalog } = useQuery(integrationsCatalogQueryOptions())
  const { connect, connectingToolkit } = useOauthConnectFlow()
  const queryClient = useQueryClient()

  const disconnect = useMutation({
    mutationFn: (accountId: string) =>
      deleteConnectionFn({ data: { accountId } }),
    onSuccess: () => {
      toast.success("Connection removed")
      return queryClient.invalidateQueries({
        queryKey: integrationsCatalogQueryOptions().queryKey,
      })
    },
    onError: (error) => {
      toast.error("Couldn't remove the connection", {
        description: error instanceof Error ? error.message : undefined,
      })
    },
  })

  const needsAction = catalog?.needs_action ?? []
  const toolkits = (catalog?.toolkits ?? []).filter((toolkit) => {
    if (kind === "apps" && toolkit.integration_kind === "source") {
      return false
    }
    if (kind === "sources" && toolkit.integration_kind === "app") {
      return false
    }
    const needle = query?.trim().toLowerCase()
    if (
      needle &&
      !`${toolkit.display_name} ${toolkit.tagline} ${toolkit.category_tags.join(" ")}`
        .toLowerCase()
        .includes(needle)
    ) {
      return false
    }
    const state = toolkitConnectionState(toolkit)
    if (tab === "connected" && state === "available") {
      return false
    }
    if (tab === "available" && state !== "available") {
      return false
    }
    return true
  })

  const grouped = new Map<string, typeof toolkits>()
  for (const toolkit of toolkits) {
    const bucket = grouped.get(toolkit.primary_category) ?? []
    bucket.push(toolkit)
    grouped.set(toolkit.primary_category, bucket)
  }

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 pb-16">
        <header className="flex flex-wrap items-end justify-between gap-4 pt-10">
          <div className="grid gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              Integrations
            </h1>
            <p className="text-sm text-muted-foreground">
              Connect the tools your team already uses and work with them
              right in the chat.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <HugeiconsIcon
                icon={Search01Icon}
                size={16}
                className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                value={query ?? ""}
                onChange={(event) => setQuery(event.target.value || null)}
                placeholder="Search integrations"
                className="w-56 pl-9"
              />
            </div>
            <RequestIntegrationDialog />
          </div>
        </header>

        <ToggleGroup
          value={tab === "all" ? [] : [tab]}
          onValueChange={(value) => {
            const next = value[value.length - 1]
            setTab(next ?? "all")
          }}
          variant="outline"
          size="sm"
          className="w-fit"
        >
          <ToggleGroupItem value="all">All</ToggleGroupItem>
          <ToggleGroupItem value="connected">Connected</ToggleGroupItem>
          <ToggleGroupItem value="available">Available</ToggleGroupItem>
        </ToggleGroup>

        {needsAction.length > 0 && (
          <section className="grid gap-3">
            <h2 className="flex items-center gap-2 text-sm font-medium text-destructive">
              <HugeiconsIcon icon={Alert02Icon} size={16} />
              Needs action
            </h2>
            {needsAction.map((account) => (
              <button
                key={account.id}
                type="button"
                onClick={() => setOpenApp(account.toolkit_slug)}
                className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-3 text-left transition-colors hover:bg-muted/40"
              >
                <IntegrationBrandLogo slug={account.toolkit_slug} size={28} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {displayNameFor(account.toolkit_slug, catalog?.toolkits)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {account.connected_assets_label ?? "1 account"} · Connected
                    by{" "}
                    {account.external_account_email ?? account.account_alias}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={(event) => {
                    event.stopPropagation()
                    void connect({
                      toolkitSlug: account.toolkit_slug,
                      displayName:
                        displayNameFor(account.toolkit_slug, catalog?.toolkits),
                      surface: "sheet_configure",
                      reconnectAccountId: account.id,
                    })
                  }}
                >
                  <HugeiconsIcon icon={RefreshIcon} size={14} />
                  Reconnect
                </Button>
              </button>
            ))}
          </section>
        )}

        <div className="grid gap-10">
          {[...grouped.entries()].map(([category, items]) => (
            <section key={category} className="grid gap-3">
              <h2 className="text-lg font-semibold tracking-tight">
                {CATEGORY_LABELS[category] ?? category}
              </h2>
              <div className="grid gap-3 md:grid-cols-2">
                {items.map((toolkit) => {
                  const state = toolkitConnectionState(toolkit)
                  return (
                    <div
                      key={toolkit.slug}
                      className="group flex items-start gap-3 rounded-xl border border-border/60 bg-card px-4 py-3 transition-colors hover:bg-muted/40"
                    >
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-start gap-3 text-left"
                        onClick={() => setOpenApp(toolkit.slug)}
                      >
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/40">
                          <IntegrationBrandLogo
                            slug={toolkit.logo_slug}
                            monochrome={toolkit.logo_monochrome}
                            size={22}
                          />
                        </span>
                        <span className="grid min-w-0 gap-0.5">
                          <span className="flex items-center gap-1.5 text-sm font-medium">
                            {toolkit.display_name}
                            {state === "connected" && (
                              <HugeiconsIcon
                                icon={CheckmarkBadge01Icon}
                                size={14}
                                className="text-primary"
                              />
                            )}
                            {state === "needs_action" && (
                              <Badge
                                variant="destructive"
                                className="h-4 px-1 text-[10px]"
                              >
                                action needed
                              </Badge>
                            )}
                            {toolkit.is_beta && (
                              <Badge
                                variant="secondary"
                                className="h-4 px-1 text-[10px]"
                              >
                                Beta
                              </Badge>
                            )}
                          </span>
                          <span className="line-clamp-1 text-xs text-muted-foreground">
                            {state === "available"
                              ? toolkit.tagline
                              : (toolkit.connections[0]
                                  ?.connected_assets_label ??
                                toolkit.tagline)}
                          </span>
                        </span>
                      </button>
                      <div className="flex shrink-0 items-center gap-2 pt-1">
                        {isAdmin && toolkit.config && (
                          <ConfigToggle toolkitSlug={toolkit.slug} />
                        )}
                        {state === "available" && (
                          <Button
                            size="icon"
                            variant="outline"
                            aria-label={`Connect ${toolkit.display_name}`}
                            disabled={connectingToolkit === toolkit.slug}
                            onClick={() =>
                              void connect({
                                toolkitSlug: toolkit.slug,
                                displayName: toolkit.display_name,
                                surface: "integrations_page",
                              })
                            }
                          >
                            <HugeiconsIcon icon={PlusSignIcon} size={16} />
                          </Button>
                        )}
                        {state !== "available" && (
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Disconnect ${toolkit.display_name}`}
                            disabled={disconnect.isPending}
                            onClick={() => {
                              const account = toolkit.connections[0]
                              if (account) {
                                disconnect.mutate(account.id)
                              }
                            }}
                          >
                            <HugeiconsIcon icon={RefreshIcon} size={16} />
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          ))}
          {toolkits.length === 0 && (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No integrations match this filter yet.
            </p>
          )}
        </div>
      </div>
    </ScrollArea>
  )
}

function ConfigToggle({ toolkitSlug }: { toolkitSlug: string }) {
  const queryClient = useQueryClient()
  const { data: catalog } = useQuery(integrationsCatalogQueryOptions())
  const toolkit = catalog?.toolkits.find((entry) => entry.slug === toolkitSlug)
  const enabled = toolkit?.config?.enabled_for_agents ?? false

  const toggle = useMutation({
    mutationFn: (next: boolean) =>
      updateToolkitConfigFn({
        data: { toolkitSlug, enabledForAgents: next },
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
    <span title={enabled ? "Enabled for agents" : "Disabled for agents"}>
      <Switch
        checked={enabled}
        disabled={toggle.isPending}
        onCheckedChange={(next) => toggle.mutate(next)}
      />
    </span>
  )
}

function displayNameFor(
  toolkitSlug: string,
  toolkits: { slug: string; display_name: string }[] | undefined,
): string {
  return toolkits?.find((toolkit) => toolkit.slug === toolkitSlug)?.display_name ?? toolkitSlug
}
