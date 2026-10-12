import {
  Alert02Icon,
  ArrowDown01Icon,
  Key01Icon,
  RefreshIcon,
  StarIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import { cn } from "@workspace/ui/lib/utils"
import { useMemo, useState } from "react"
import { ProviderLogo } from "@/components/providers/provider-logo"
import type { Catalog, Connection, ProviderSpec } from "../catalog/capabilities"
import { resolveCapabilities } from "../catalog/resolve"
import {
  buildModelViews,
  type CapabilityStatus,
  formatContextWindow,
  type ModelView,
  rankModels,
} from "../data/model-views"
import { useComposerEvent } from "../hooks/use-composer-event"
import { usePromptStore } from "../state/prompt-store"
import { EffortControl } from "./effort-control"

type Tab = {
  id: string
  label: string
  vendor: string | null
  kind: "starred" | "provider"
}

/**
 * Provider and model are one surface, not two controls.
 *
 * Provider selection as a separate trigger makes the user think of them as
 * independent choices when they are in fact a single fact — "this model" always
 * implies its provider. A tab strip keeps that relationship visible and makes
 * the provider a filter over the catalog rather than a separate state the
 * user has to keep in sync.
 */
export function ModelPicker() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [tab, setTab] = useState<string>("starred")

  const providers = usePromptStore((s) => s.providers)
  const runtime = usePromptStore((s) => s.runtime)
  const selection = usePromptStore((s) => s.selection)
  const starred = usePromptStore((s) => s.starredModels)
  const hydrated = usePromptStore((s) => s.hydrated)
  const providersError = usePromptStore((s) => s.providersError)
  const hasNoProviders = hydrated && !providersError && providers.length === 0

  // The `/model` and `/effort` commands and the ⌘⇧P shortcut open this picker
  // by event rather than by import, so the command table can stay free of
  // component references.
  useComposerEvent("composer:open-model-picker", () => setOpen(true))
  useComposerEvent("composer:open-effort", () => setOpen(true))

  const views = useMemo(() => {
    const catalogs = Object.fromEntries(
      providers.map((p) => [p.id, runtime[p.id]?.catalog ?? { state: "idle" }]),
    )
    const connections = Object.fromEntries(
      providers.map((p) => [
        p.id,
        runtime[p.id]?.connection ?? { state: "absent" },
      ]),
    )
    const entitlements = Object.fromEntries(
      providers.map((p) => [p.id, runtime[p.id]?.entitlements ?? {}]),
    )

    return buildModelViews({
      catalogs,
      connections,
      entitlements,
      resolve: (providerId, model) => {
        const provider = providers.find((p) => p.id === providerId)
        const entry = runtime[providerId]
        if (!provider) {
          // Unreachable in practice — the catalogs above are keyed by these
          // same providers — but a view for a provider the list has dropped
          // must not resolve against a fabricated spec.
          return null
        }
        return resolveCapabilities({
          provider,
          model,
          connection: entry?.connection ?? { state: "absent" },
          entitlements: entry?.entitlements ?? {},
        })
      },
      selected: selection,
      starred,
    })
    // `providers` and `runtime` identities change exactly when a catalog does.
  }, [providers, runtime, selection, starred])

  const ranked = useMemo(() => rankModels(views), [views])

  const visible = useMemo(() => {
    let pool = ranked
    if (tab === "starred") {
      pool = pool.filter((view) => starred.includes(modelKey(view)))
    } else {
      pool = pool.filter((view) => view.providerId === tab)
    }
    if (!query) return pool
    const needle = query.toLowerCase()
    return pool.filter(
      (view) =>
        view.model.name.toLowerCase().includes(needle) ||
        view.model.tagline.toLowerCase().includes(needle) ||
        view.providerId.toLowerCase().includes(needle),
    )
  }, [ranked, tab, query, starred])

  const selectedView = ranked.find((view) => view.isSelected) ?? null
  const selectedProvider = providers.find((p) => p.id === selection?.providerId)

  const tabs: Tab[] = [
    { id: "starred", label: "Starred", vendor: null, kind: "starred" },
    ...providers.map((p) => ({
      id: p.id,
      label: p.label,
      vendor: p.source.vendor,
      kind: "provider" as const,
    })),
  ]

  const select = (view: ModelView) => {
    usePromptStore.getState().select(view.providerId, view.model.id)
    setOpen(false)
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next, details) => {
        // A press inside the popup closes it, which for the tab strip means
        // every tab switch would dismiss the picker. Focus-driven closes are
        // honoured, because those are the ones the user did not ask for.
        if (!next && details.reason === "close-press") {
          const inside = details.event?.target
          if (inside instanceof Node && details.trigger?.contains(inside))
            return
        }
        setOpen(next)
      }}
    >
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="h-8 min-w-0 shrink gap-1.5 rounded-full px-2.5 text-sm font-normal"
            aria-label="Change model"
          />
        }
      >
        {selectedView ? (
          <>
            <span className="max-w-32 truncate">{selectedView.model.name}</span>
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              className="size-3.5 shrink-0 opacity-60"
            />
          </>
        ) : hasNoProviders ? (
          <>
            <span className="text-muted-foreground">
              No provider configured
            </span>
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              className="size-3.5 shrink-0 opacity-60"
            />
          </>
        ) : (
          <>
            <span className="text-muted-foreground">Select model</span>
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              className="size-3.5 shrink-0 opacity-60"
            />
          </>
        )}
      </PopoverTrigger>

      <PopoverContent
        align="start"
        side="top"
        sideOffset={10}
        className="w-[min(26rem,calc(100vw-2rem))] gap-0 overflow-hidden p-0"
      >
        {/* Provider tabs double as the connection indicator: a provider with
            no key still gets a tab, because hiding it would make the missing
            credential invisible until the user went looking for it. */}
        <div className="flex items-center gap-0.5 overflow-x-auto border-b border-border px-2 py-1.5">
          {tabs.map((entry) => {
            const isActive = entry.id === tab
            const connection =
              entry.kind === "provider"
                ? runtime[entry.id]?.connection
                : undefined
            const needsKey =
              connection?.state === "absent" || connection?.state === "invalid"
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => {
                  setTab(entry.id)
                  setQuery("")
                }}
                className={cn(
                  "relative flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-sm transition-colors",
                  isActive
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {entry.kind === "starred" ? (
                  <HugeiconsIcon icon={StarIcon} className="size-3.5" />
                ) : null}
                {/* The mark stands in for the name; the tooltip names it on a
                    delayed hover, so scanning a row of them stays quiet. */}
                <ProviderLogo
                  provider={entry.vendor ?? entry.label}
                  label={entry.label}
                  size={16}
                />
                {needsKey ? (
                  <HugeiconsIcon
                    icon={Key01Icon}
                    className="size-3 text-amber-500"
                  />
                ) : null}
              </button>
            )
          })}
        </div>

        {hasNoProviders ? (
          <EmptyState
            title="No model provider configured"
            body="Turns cannot run until the workspace saves one. Add it in settings."
            action={
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setOpen(false)
                  window.dispatchEvent(
                    new CustomEvent("composer:open-provider-picker"),
                  )
                }}
              >
                Manage saved providers…
              </Button>
            }
          />
        ) : (
          <>
            <div className="border-b border-border p-2">
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search models…"
                className="h-8 border-none bg-transparent shadow-none focus-visible:ring-0"
                autoFocus
              />
            </div>

            <ScrollArea className="max-h-72">
              {tab === "starred" && starred.length === 0 ? (
                <EmptyState
                  title="No starred models"
                  body="Pick a provider tab and star a model to pin it here."
                />
              ) : visible.length === 0 ? (
                <EmptyState
                  title="No matches"
                  body={`Nothing matches “${query}”.`}
                />
              ) : (
                <ul className="flex flex-col p-1">
                  {visible.map((view, index) => (
                    <ModelRow
                      key={modelKey(view)}
                      view={view}
                      // ⌘1–⌘9 jump straight to a model without reaching for the
                      // mouse, which is how the list is actually used once someone
                      // knows their way around it.
                      shortcut={index < 9 ? index + 1 : null}
                      starred={starred.includes(modelKey(view))}
                      onSelect={() => select(view)}
                      onToggleStar={() =>
                        usePromptStore.getState().toggleStar(modelKey(view))
                      }
                    />
                  ))}
                </ul>
              )}
            </ScrollArea>

            {/* Effort lives in this popover's footer because it is meaningless
            without a model: its levels are a property of the model above. */}
            {selectedView ? (
              <div className="flex items-center justify-between gap-3 border-t border-border p-2">
                <EffortControl />
                <span className="text-muted-foreground text-xs tabular-nums">
                  {formatContextWindow(selectedView.model.limits.contextWindow)}{" "}
                  ctx
                </span>
              </div>
            ) : selectedProvider ? (
              <div className="border-t border-border p-2">
                <EmptyState
                  title="No model selected"
                  body="Pick a model to configure effort."
                />
              </div>
            ) : null}
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}

function modelKey(view: ModelView): string {
  return `${view.providerId}/${view.model.id}`
}

const SKELETON_ROWS = ["row-1", "row-2", "row-3", "row-4"]

const STATUS_LABEL: Record<CapabilityStatus, string> = {
  available: "",
  "gated-connect": "Connect key",
  "gated-upgrade": "Upgrade required",
  "gated-region": "Unavailable in region",
  "gated-capacity": "At capacity",
  unsupported: "Unavailable",
  "no-model": "",
}

function ModelRow({
  view,
  shortcut,
  starred,
  onSelect,
  onToggleStar,
}: {
  view: ModelView
  shortcut: number | null
  starred: boolean
  onSelect: () => void
  onToggleStar: () => void
}) {
  const locked = view.status !== "available" && view.status !== "unsupported"
  const unavailable = view.status === "unsupported"

  return (
    <li>
      <div
        className={cn(
          "group flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors",
          view.isSelected ? "bg-accent" : "hover:bg-accent/60",
          unavailable && "opacity-50",
        )}
      >
        <button
          type="button"
          onClick={onSelect}
          disabled={unavailable}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="flex items-center gap-1.5">
              <span className="truncate text-sm font-medium">
                {view.model.name}
              </span>
              {view.badges.map((badge) => (
                <span
                  key={badge}
                  className="text-muted-foreground rounded px-1 text-[10px] uppercase tracking-wide"
                >
                  {badge}
                </span>
              ))}
            </span>
            <span className="text-muted-foreground truncate text-xs">
              {STATUS_LABEL[view.status] || view.model.tagline}
            </span>
          </span>

          {shortcut ? (
            <kbd className="text-muted-foreground hidden shrink-0 rounded border border-border px-1 text-[10px] tabular-nums group-hover:inline">
              ⌘{shortcut}
            </kbd>
          ) : null}

          {locked ? (
            <HugeiconsIcon
              icon={Key01Icon}
              className="size-3.5 shrink-0 text-amber-500"
            />
          ) : null}
        </button>

        <button
          type="button"
          onClick={onToggleStar}
          aria-label={starred ? "Unstar model" : "Star model"}
          className="shrink-0 p-1"
        >
          <HugeiconsIcon
            icon={StarIcon}
            className={cn(
              "size-3.5 transition-colors",
              starred
                ? "fill-amber-400 text-amber-400"
                : "text-muted-foreground/40 hover:text-muted-foreground",
            )}
          />
        </button>
      </div>
    </li>
  )
}

/**
 * The body for a provider whose models cannot be shown — not an error screen
 * but the thing that resolves it. This is where the `connect` gate from the
 * capability resolver becomes an actual input.
 */
export function ProviderGate({
  provider,
  catalog,
  connection,
  onConnect,
  onRetry,
}: {
  provider: ProviderSpec
  catalog: Catalog
  connection: Connection
  onConnect: (credential: string) => void
  onRetry: () => void
}) {
  const [credential, setCredential] = useState("")

  if (connection.state === "validating") {
    return (
      <div className="flex flex-col gap-1 p-3">
        {SKELETON_ROWS.map((row) => (
          <div
            key={row}
            className="bg-accent/50 h-8 animate-pulse rounded-md"
          />
        ))}
      </div>
    )
  }

  if (connection.state === "unreachable" || catalog.state === "failed") {
    return (
      <EmptyState
        title="Couldn't reach the provider"
        body="Check the key and try again."
        action={
          <Button size="sm" variant="outline" onClick={onRetry}>
            <HugeiconsIcon icon={RefreshIcon} className="size-3.5" />
            Retry
          </Button>
        }
      />
    )
  }

  if (!provider.source.requiresCredential) {
    return (
      <EmptyState
        title="No models found"
        body={`${provider.label} returned nothing.`}
      />
    )
  }

  return (
    <div className="flex flex-col gap-2 p-3">
      <p className="text-sm font-medium">Connect {provider.label}</p>
      <p className="text-muted-foreground text-xs">
        {connection.state === "invalid"
          ? "That key was rejected. Enter a new one to continue."
          : "Add an API key to load this provider's models."}
      </p>
      <Input
        type="password"
        value={credential}
        onChange={(event) => setCredential(event.target.value)}
        placeholder="sk-…"
        className="h-8"
        autoFocus
      />
      <Button
        size="sm"
        disabled={!credential.trim()}
        onClick={() => onConnect(credential.trim())}
      >
        Connect
      </Button>
    </div>
  )
}

function EmptyState({
  title,
  body,
  action,
}: {
  title: string
  body: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
      <HugeiconsIcon
        icon={Alert02Icon}
        className="text-muted-foreground size-5"
      />
      <p className="text-sm font-medium">{title}</p>
      <p className="text-muted-foreground text-xs">{body}</p>
      {action}
    </div>
  )
}
