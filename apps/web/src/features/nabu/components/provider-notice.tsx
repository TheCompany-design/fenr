/**
 * What a workspace's chat is actually running on.
 *
 * Shown above the composer rather than buried in settings, because the most
 * common reason a turn cannot start is that nobody has configured a provider yet —
 * and a user who has just typed a message deserves to be told that before they
 * type it, not after.
 *
 * Deliberately thin: it says what the runtime already decided and nothing more.
 * It never renders the endpoint's full URL, because a workspace may have put a
 * path there it considers private, and a chat header is not the place to
 * broadcast it.
 */

import {
  Alert02Icon,
  CloudServerIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { Badge } from "@workspace/ui/components/badge"
import type { TenantProvider } from "@/lib/schemas/nabu"

import { tenantProviderQueryOptions } from "../queries"

export interface ProviderBannerProps {
  /**
   * Whether the viewer may fix the problem.
   *
   * Drives whether this offers a link to settings. A member who cannot change
   * the provider is told what is configured, and left to ask someone who can —
   * a link to a screen they will be refused on is worse than no link.
   */
  canAdminister: boolean
}

/**
 * The origin of an endpoint, which is the part safe to display.
 *
 * Falls back to the host when the URL will not parse, so a malformed value shows
 * as something rather than rendering an empty badge.
 */
export function endpointOrigin(baseUrl: string): string | null {
  try {
    const url = new URL(baseUrl)
    return url.host
  } catch {
    return null
  }
}

/**
 * Renders nothing until it knows, and nothing if it cannot.
 *
 * `useQuery` rather than `useSuspenseQuery`, deliberately: this line sits inside
 * the chat container, and a suspending status bar would put a whole conversation
 * behind a settings read. It is supplementary — the conversation works without
 * it — so a slow or failed read must be invisible rather than a blank screen.
 */
export function ProviderBanner({ canAdminister }: ProviderBannerProps) {
  const { data: provider } = useQuery(tenantProviderQueryOptions())

  if (!provider) return null

  return <ProviderNotice provider={provider} canAdminister={canAdminister} />
}

/**
 * The presentational half, separated so a test can assert on what a user is told
 * without standing up a query client.
 */
export function ProviderNotice({
  provider,
  canAdminister,
}: {
  provider: TenantProvider
  canAdminister: boolean
}) {
  if (!provider.configured) {
    return (
      <Notice tone="warning">
        <HugeiconsIcon icon={Alert02Icon} size={14} className="shrink-0" />
        <span className="min-w-0 flex-1">
          This workspace has no model provider, so turns cannot run.
        </span>
        {canAdminister ? (
          <Link
            to="/settings/provider"
            className="shrink-0 rounded-md px-2 py-0.5 font-medium underline underline-offset-2 transition-colors hover:bg-background"
          >
            Configure
          </Link>
        ) : (
          <span className="shrink-0 text-muted-foreground">
            Ask an admin to configure one
          </span>
        )}
      </Notice>
    )
  }

  const origin = endpointOrigin(provider.base_url)

  return (
    <Notice tone="muted">
      <HugeiconsIcon
        icon={Tick02Icon}
        size={14}
        className="shrink-0 text-muted-foreground"
      />
      <span className="min-w-0 truncate">
        Running on{" "}
        <span className="font-medium text-foreground">{provider.model}</span>
        {origin ? (
          <>
            {" "}
            via <span className="font-mono text-[11px]">{origin}</span>
          </>
        ) : null}
      </span>
      <Badge variant="secondary" className="shrink-0 text-[10px] font-normal">
        <HugeiconsIcon icon={CloudServerIcon} size={11} />
        Workspace provider
      </Badge>
      {canAdminister ? (
        <Link
          to="/settings/provider"
          className="shrink-0 rounded-md px-2 py-0.5 transition-colors hover:bg-background"
        >
          Change
        </Link>
      ) : null}
    </Notice>
  )
}

function Notice({
  tone,
  children,
}: {
  tone: "warning" | "muted"
  children: React.ReactNode
}) {
  return (
    <div
      role={tone === "warning" ? "status" : undefined}
      className={`flex items-center gap-2 border-t px-4 py-2 text-xs sm:px-8 ${
        tone === "warning"
          ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
          : "border-border/70 bg-muted/20 text-muted-foreground"
      }`}
    >
      {children}
    </div>
  )
}
