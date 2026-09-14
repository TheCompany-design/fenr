/**
 * Settings shell. The chrome stays mounted while each settings section is
 * rendered through the outlet below it.
 */
import {
  Alert02Icon,
  Building01Icon,
  CrownIcon,
  Shield01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  createFileRoute,
  type ErrorComponentProps,
  Link,
  Outlet,
  useRouter,
  useRouterState,
} from "@tanstack/react-router"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import { SPRING_LAYOUT } from "@workspace/ui/lib/ease"
import { cn } from "@workspace/ui/lib/utils"
import { m, useReducedMotion } from "motion/react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import {
  OrganizationAvatar,
  organizationInvitationsQueryOptions,
  organizationMembersQueryOptions,
} from "@/features/organizations"
import { moduleLogger } from "@/lib/logger"

const SETTINGS_SECTIONS = [
  { id: "general", label: "General", icon: Building01Icon, to: "/settings" },
  {
    id: "members",
    label: "Members & invites",
    icon: Shield01Icon,
    to: "/settings/members",
  },
  {
    id: "danger",
    label: "Danger zone",
    icon: Alert02Icon,
    to: "/settings/danger",
  },
] as const

const log = moduleLogger("settings-shell")

export const Route = createFileRoute("/_app/settings")({
  loader: async ({ context }) => {
    const activeOrg = context.activeOrganization
    if (activeOrg) {
      await Promise.all([
        context.queryClient.ensureQueryData(
          organizationMembersQueryOptions(activeOrg.organization.id),
        ),
        activeOrg.role === "owner" || activeOrg.role === "admin"
          ? context.queryClient.ensureQueryData(
              organizationInvitationsQueryOptions(activeOrg.organization.id),
            )
          : Promise.resolve(),
      ])
    }
  },
  component: SettingsShellRoute,
  errorComponent: SettingsErrorComponent,
})

function SettingsShellRoute() {
  const { activeOrganization } = Route.useRouteContext()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const reduce = useReducedMotion() ?? false
  const [hoveredSection, setHoveredSection] = useState<string | null>(null)
  const org = activeOrganization.organization
  const role =
    activeOrganization.role === "owner" || activeOrganization.role === "admin"
      ? activeOrganization.role
      : "member"
  const isOwner = role === "owner"
  const activeSection =
    SETTINGS_SECTIONS.find((section) => section.to === pathname)?.id ??
    "general"
  const pillSection = hoveredSection ?? activeSection

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
      <header className="z-30 flex shrink-0 border-b border-border/70 bg-background/95 px-5 py-4 backdrop-blur-md sm:px-6 lg:px-8">
        <div className="flex w-full min-w-0 items-center gap-3">
          <OrganizationAvatar
            name={org.name}
            slug={org.slug}
            logo={org.logo}
            size="lg"
            className="size-11 shrink-0 rounded-xl border border-border text-base"
          />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h1 className="truncate font-semibold text-lg tracking-tight sm:text-xl">
                Workspace settings
              </h1>
              <Badge
                variant={isOwner ? "default" : "secondary"}
                className="capitalize text-xs font-normal"
              >
                <HugeiconsIcon
                  icon={isOwner ? CrownIcon : Shield01Icon}
                  size={12}
                />
                {role}
              </Badge>
            </div>
            <p className="truncate font-mono text-xs text-muted-foreground sm:text-sm">
              fenr.app/{org.slug}
            </p>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:flex-row">
        <aside className="w-full shrink-0 border-b border-border/70 bg-muted/10 lg:w-64 lg:border-r lg:border-b-0">
          <nav aria-label="Organization settings" className="p-4 sm:p-5 lg:p-6">
            <div className="flex min-w-0 flex-wrap gap-1 rounded-xl border border-border/70 bg-muted/20 p-1 lg:flex-col">
              {SETTINGS_SECTIONS.map((section) => {
                const active = section.id === activeSection
                const pillActive = section.id === pillSection
                return (
                  <Link
                    key={section.id}
                    to={section.to}
                    onPointerMove={(event) => {
                      if (event.pointerType !== "touch") {
                        setHoveredSection(section.id)
                      }
                    }}
                    onPointerLeave={() => setHoveredSection(null)}
                    onFocus={() => setHoveredSection(section.id)}
                    onBlur={() => setHoveredSection(null)}
                    className={cn(
                      "relative isolate flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active
                        ? "text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {pillActive && (
                      <m.span
                        layoutId="settings-sidebar-pill"
                        className="pointer-events-none absolute inset-0 -z-10 rounded-lg border border-border/70 bg-background shadow-xs"
                        transition={reduce ? { duration: 0 } : SPRING_LAYOUT}
                      />
                    )}
                    <HugeiconsIcon
                      icon={section.icon}
                      size={16}
                      className="shrink-0"
                    />
                    <span className="whitespace-nowrap">{section.label}</span>
                  </Link>
                )
              })}
            </div>
          </nav>
        </aside>

        <ScrollArea className="min-h-0 min-w-0 flex-1 w-full">
          <main className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col p-4 sm:p-6 lg:p-8">
            <Outlet />
          </main>
        </ScrollArea>
      </div>
    </div>
  )
}

function SettingsErrorComponent({ reset }: ErrorComponentProps) {
  const router = useRouter()
  const [isRetrying, setIsRetrying] = useState(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const handleRetry = async () => {
    if (isRetrying) return
    setIsRetrying(true)
    try {
      await router.invalidate()
      reset()
    } catch (err) {
      log.error({ err }, "Failed to reload settings on retry")
      toast.error("Retry failed", {
        description: "Could not reload settings. Please try again.",
      })
    } finally {
      if (mountedRef.current) setIsRetrying(false)
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <div className="flex max-w-md flex-col items-center rounded-xl border border-border/60 bg-card p-8 text-center shadow-xs">
        <HugeiconsIcon
          icon={Alert02Icon}
          size={24}
          className="mb-4 text-destructive"
        />
        <h2 className="text-lg font-semibold">Unable to load settings</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          We couldn&apos;t load the workspace settings. Please try again.
        </p>
        <Button
          className="mt-4"
          onClick={handleRetry}
          disabled={isRetrying}
          variant="outline"
        >
          {isRetrying ? "Retrying..." : "Try again"}
        </Button>
      </div>
    </div>
  )
}
