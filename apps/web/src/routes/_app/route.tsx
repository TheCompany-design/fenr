/**
 * Pathless guard layout for the whole authenticated app area.
 *
 * Every nested route (including /) requires a valid session: unauthenticated
 * navigation is redirected to /auth/sign-in, preserving the intended
 * destination in the `redirect` search param. Server functions must still
 * authorize themselves via ensureSession() or authMiddleware — this UI guard
 * alone is never sufficient (review-framework invariant #7).
 *
 * The shell composition lives here too: every authenticated screen renders
 * inside the AppShell. The session arrives via router context — it is never
 * refetched by shell chrome.
 */
import { AlertCircleIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import type { ErrorComponentProps } from "@tanstack/react-router"
import {
  createFileRoute,
  Outlet,
  redirect,
  useRouter,
} from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { AppShell } from "@/components/shell/app-shell"
import { resolveAppOrganizationAccessFn } from "@/features/organizations"
import { moduleLogger } from "@/lib/logger"
import { safeRedirectPath } from "@/lib/redirect"
import { getSession } from "@/lib/session"
import { getSidebarOpen } from "@/lib/ui-prefs"

const log = moduleLogger("app-guard")

function GuardLayout() {
  const { session, sidebarOpen, activeOrganization } = Route.useRouteContext()
  return (
    <AppShell
      defaultOpen={sidebarOpen}
      user={session.user}
      activeOrganization={activeOrganization}
    >
      <Outlet />
    </AppShell>
  )
}

export function AppErrorComponent({ reset }: ErrorComponentProps) {
  const router = useRouter()
  const [isRetrying, setIsRetrying] = useState(false)
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const handleRetry = async () => {
    if (isRetrying) return
    setIsRetrying(true)

    try {
      await router.invalidate()
      reset()
    } catch (err) {
      log.error({ err }, "Failed to reload route on retry")
      toast.error("Retry failed", {
        description: "Could not reload the workspace. Please try again.",
      })
    } finally {
      if (isMountedRef.current) {
        setIsRetrying(false)
      }
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center bg-background">
      <div className="max-w-md space-y-4">
        <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
          <HugeiconsIcon icon={AlertCircleIcon} size={24} />
        </div>
        <h1 className="text-xl font-semibold text-foreground">
          Unable to load organization
        </h1>
        <p className="text-sm text-muted-foreground">
          We encountered a problem resolving your workspace access. Please try
          again.
        </p>
        <Button onClick={handleRetry} disabled={isRetrying} variant="outline">
          {isRetrying ? "Retrying..." : "Try again"}
        </Button>
      </div>
    </div>
  )
}

export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ location }) => {
    // Parallel: both are cheap server reads, so the common (authenticated)
    // path pays one round of concurrent work instead of two sequential ones.
    const [session, sidebarOpen] = await Promise.all([
      getSession(),
      getSidebarOpen(),
    ])
    if (!session) {
      throw redirect({
        to: "/auth/sign-in",
        search: { redirect: safeRedirectPath(location.href) },
      })
    }

    let access: Awaited<ReturnType<typeof resolveAppOrganizationAccessFn>>
    try {
      access = await resolveAppOrganizationAccessFn()
    } catch (error) {
      log.error(
        { err: error, userId: session.user.id },
        "Failed to resolve organization access for authenticated user",
      )
      throw error
    }

    if (access.status === "no_organizations") {
      throw redirect({ to: "/onboarding", search: { step: "naming" } })
    }
    if (access.status === "choose_organization") {
      throw redirect({
        to: "/choose-organization",
        search: { redirect: safeRedirectPath(location.href) },
      })
    }

    return {
      session: {
        ...session,
        session: {
          ...session.session,
          activeOrganizationId: access.activeOrganization.organization.id,
        },
      },
      sidebarOpen,
      activeOrganization: access.activeOrganization,
    }
  },
  component: GuardLayout,
  errorComponent: AppErrorComponent,
})
