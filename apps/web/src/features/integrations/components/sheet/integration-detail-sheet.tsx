import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Cancel01Icon,
  Delete02Icon,
  Link01Icon,
  LinkSquare02Icon,
  RefreshIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { parseAsString, useQueryState } from "nuqs"
import { toast } from "sonner"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import {
  Sheet,
  SheetContent,
  SheetHeader,
} from "@workspace/ui/components/sheet"
import {
  integrationToolkitDetailQueryOptions,
  integrationsCatalogQueryOptions,
} from "../../api/integrations-queries"
import { deleteConnectionFn, putToolPolicyFn } from "../../api/integrations.functions"
import { useOauthConnectFlow } from "../../hooks/use-oauth-connect-flow"
import { IntegrationBrandLogo } from "../integration-brand-logo"

const CAPABILITY_LABELS: Record<string, string> = {
  read_only: "Read-only",
  standard_write: "Write",
  external_comms: "External communications",
  destructive: "Destructive",
  financial: "Financial",
}

const MODE_LABELS: Record<string, string> = {
  auto_approve: "Auto-approve",
  require_approval: "Always ask in chat",
  deny: "Blocked",
}

export function IntegrationDetailSheet({ isAdmin }: { isAdmin: boolean }) {
  const [toolkitSlug, setToolkitSlug] = useQueryState("app")
  const [, setSheetTab] = useQueryState(
    "sheet_tab",
    parseAsString,
  )

  const open = toolkitSlug !== null
  const { data: toolkit } = useQuery({
    ...integrationToolkitDetailQueryOptions(toolkitSlug ?? ""),
    enabled: open,
  })

  const { connect, connectingToolkit } = useOauthConnectFlow()
  const queryClient = useQueryClient()

  const disconnect = useMutation({
    mutationFn: (accountId: string) => deleteConnectionFn({ data: { accountId } }),
    onSuccess: async () => {
      toast.success("Connection removed")
      await queryClient.invalidateQueries({
        queryKey: integrationsCatalogQueryOptions().queryKey,
      })
    },
    onError: (error) => {
      toast.error("Couldn't remove the connection", {
        description: error instanceof Error ? error.message : undefined,
      })
    },
  })

  const policy = useMutation({
    mutationFn: (input: { toolSlug: string; mode: string }) =>
      putToolPolicyFn({
        data: {
          toolSlug: input.toolSlug,
          approvalMode: input.mode as "auto_approve" | "require_approval" | "deny",
        },
      }),
    onSuccess: async () => {
      toast.success("Approval policy saved")
      if (toolkitSlug) {
        await queryClient.invalidateQueries({
          queryKey: integrationToolkitDetailQueryOptions(toolkitSlug).queryKey,
        })
      }
    },
    onError: (error) => {
      toast.error("Couldn't save the policy", {
        description: error instanceof Error ? error.message : undefined,
      })
    },
  })

  const healthyConnection = toolkit?.connections.find((account) =>
    ["active", "initiating"].includes(account.status),
  )
  const brokenConnection = toolkit?.connections.find((account) =>
    ["expired", "needs_reauth", "error"].includes(account.status),
  )

  const primaryAction = brokenConnection
    ? {
        label: "Reconnect",
        variant: "destructive" as const,
        onClick: () =>
          brokenConnection &&
          void connect({
            toolkitSlug: toolkit?.slug ?? "",
            displayName: toolkit?.display_name ?? "",
            surface: "sheet_configure" as const,
            reconnectAccountId: brokenConnection.id,
          }),
      }
    : healthyConnection
      ? { label: "Configure", variant: "outline" as const, onClick: () => setSheetTab("accounts") }
      : {
          label: toolkit?.supported_auth_schemes[0] === "API_KEY" ? "Configure" : "Connect",
          variant: "default" as const,
          onClick: () =>
            toolkit &&
            void connect({
              toolkitSlug: toolkit.slug,
              displayName: toolkit.display_name,
              surface: "sheet_configure" as const,
            }),
        }

  return (
    <Sheet open={open} onOpenChange={(next) => !next && setToolkitSlug(null)}>
      <SheetContent
        side="right"
        className="flex flex-col gap-0 p-0 sm:max-w-[540px]"
      >
        <SheetHeader className="flex flex-row items-center justify-between border-b border-border px-5 py-3">
          <p className="truncate text-sm text-muted-foreground">
            Integrations{" "}
            <span className="font-semibold text-foreground">
              / {toolkit?.display_name ?? "…"}
            </span>
          </p>
          <div className="flex items-center gap-1">
            {toolkit && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={<Button variant="ghost" size="icon" />}
                >
                  <span aria-hidden>⋯</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {toolkit.config?.has_auth_config && (
                    <DropdownMenuItem
                      onClick={() =>
                        healthyConnection &&
                        disconnect.mutate(healthyConnection.id)
                      }
                    >
                      Manage connected accounts
                    </DropdownMenuItem>
                  )}
                  {toolkit.vendor_url && (
                    <DropdownMenuItem
                      onClick={() =>
                        window.open(toolkit.vendor_url ?? "", "_blank")
                      }
                    >
                      Visit the vendor
                    </DropdownMenuItem>
                  )}
                  {healthyConnection && (
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => disconnect.mutate(healthyConnection.id)}
                    >
                      Disconnect
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {toolkit?.documentation_url && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Open documentation"
                onClick={() =>
                  window.open(toolkit.documentation_url ?? "", "_blank")
                }
              >
                <HugeiconsIcon icon={LinkSquare02Icon} size={16} />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              aria-label="Close"
              onClick={() => setToolkitSlug(null)}
            >
              <HugeiconsIcon icon={Cancel01Icon} size={16} />
            </Button>
          </div>
        </SheetHeader>

        {toolkit ? (
          <ScrollArea className="min-h-0 flex-1">
            <div className="grid gap-6 px-6 py-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <span className="flex size-14 items-center justify-center rounded-xl border border-border/60 bg-muted/40">
                    <IntegrationBrandLogo
                      slug={toolkit.logo_slug}
                      monochrome={toolkit.logo_monochrome}
                      size={30}
                    />
                  </span>
                  <div className="grid gap-0.5">
                    <h2 className="text-xl font-semibold tracking-tight">
                      {toolkit.display_name}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      By {toolkit.vendor_name}
                    </p>
                  </div>
                </div>
                <Button
                  variant={primaryAction.variant}
                  size="sm"
                  disabled={connectingToolkit === toolkit.slug}
                  onClick={primaryAction.onClick}
                >
                  <HugeiconsIcon icon={RefreshIcon} size={14} />
                  {primaryAction.label}
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {toolkit.category_tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-[10px]">
                    {tag}
                  </Badge>
                ))}
                <Badge variant="secondary" className="text-[10px]">
                  {toolkit.setup_steps_count} STEPS
                </Badge>
                {brokenConnection && (
                  <Badge variant="destructive" className="text-[10px]">
                    CONNECTION ERROR
                  </Badge>
                )}
                {!brokenConnection && healthyConnection && (
                  <Badge className="text-[10px]">CONNECTED</Badge>
                )}
              </div>

              <p className="text-sm leading-relaxed text-muted-foreground">
                {toolkit.short_description}
              </p>

              {toolkit.preview_media.length > 0 && (
                <div className="overflow-x-auto pb-2">
                  <div className="flex w-max gap-3">
                    {toolkit.preview_media.map((media) => (
                      <figure
                        key={media.imageUrl}
                        className="w-[260px] shrink-0 overflow-hidden rounded-xl border border-border"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={media.imageUrl}
                          alt={media.title}
                          className="h-[165px] w-full object-cover"
                        />
                      </figure>
                    ))}
                  </div>
                </div>
              )}

              <section className="grid gap-2">
                <h3 className="text-sm font-semibold">Overview</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {toolkit.overview_markdown}
                  {toolkit.documentation_url && (
                    <>
                      {" "}
                      <a
                        href={toolkit.documentation_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-0.5 text-primary underline underline-offset-2"
                      >
                        Documentation.
                        <HugeiconsIcon icon={Link01Icon} size={12} />
                      </a>
                    </>
                  )}
                </p>
              </section>

              {toolkit.how_it_works_markdown && (
                <section className="grid gap-2">
                  <h3 className="text-sm font-semibold">How it works</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {toolkit.how_it_works_markdown}
                  </p>
                </section>
              )}

              <section className="grid gap-3" id="accounts">
                <h3 className="text-sm font-semibold">Connected accounts</h3>
                {toolkit.connections.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No accounts connected yet.
                  </p>
                )}
                {toolkit.connections.map((account) => (
                  <div
                    key={account.id}
                    className="flex items-center gap-3 rounded-xl border border-border/60 px-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {account.account_alias}{" "}
                        <Badge
                          variant={
                            account.status === "active" ? "secondary" : "destructive"
                          }
                          className="ml-1 text-[10px]"
                        >
                          {account.status}
                        </Badge>
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {account.owner_scope === "organization"
                          ? "Workspace-shared"
                          : "Personal"}{" "}
                        ·{" "}
                        {account.external_account_email ??
                          account.status_error_message ??
                          "pending"}
                      </p>
                    </div>
                    {["expired", "needs_reauth", "error"].includes(
                      account.status,
                    ) && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() =>
                          void connect({
                            toolkitSlug: toolkit.slug,
                            displayName: toolkit.display_name,
                            surface: "sheet_configure",
                            reconnectAccountId: account.id,
                          })
                        }
                      >
                        Reconnect
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Disconnect"
                      onClick={() => disconnect.mutate(account.id)}
                    >
                      <HugeiconsIcon icon={Delete02Icon} size={14} />
                    </Button>
                  </div>
                ))}
              </section>

              {isAdmin && (
                <section className="grid gap-3">
                  <h3 className="text-sm font-semibold">
                    Actions & approval policies
                  </h3>
                  {toolkit.tools.map((tool) => {
                    const activePolicy = toolkit.policies.find(
                      (entry) =>
                        entry.policy_scope === "organization" &&
                        entry.tool_slug === tool.slug,
                    )
                    const effectiveMode =
                      activePolicy?.approval_mode ?? tool.default_approval_mode
                    return (
                      <div
                        key={tool.slug}
                        className="flex items-start gap-3 rounded-xl border border-border/60 px-3 py-2.5"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {tool.display_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {CAPABILITY_LABELS[tool.capability_class] ??
                              tool.capability_class}
                          </p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={<Button variant="outline" size="sm" />}
                          >
                            {MODE_LABELS[effectiveMode] ?? effectiveMode}
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {Object.entries(MODE_LABELS).map(([mode, label]) => (
                              <DropdownMenuItem
                                key={mode}
                                onClick={() =>
                                  policy.mutate({ toolSlug: tool.slug, mode })
                                }
                              >
                                {label}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )
                  })}
                </section>
              )}
            </div>
          </ScrollArea>
        ) : (
          <div className="grid flex-1 place-items-center text-sm text-muted-foreground">
            Loading…
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
