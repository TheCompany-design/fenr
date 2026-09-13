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
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"

import { AppShell } from "@/components/shell/app-shell"
import { resolveAppOrganizationAccessFn } from "@/features/organizations"
import { safeRedirectPath } from "@/lib/redirect"
import { getSession } from "@/lib/session"
import { getSidebarOpen } from "@/lib/ui-prefs"

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
    } catch {
      throw redirect({
        to: "/auth/sign-in",
        search: { redirect: safeRedirectPath(location.href) },
      })
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
})
