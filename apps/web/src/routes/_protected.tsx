/**
 * Pathless guard layout for the whole authenticated app area.
 *
 * Every nested route (including /) requires a valid session: unauthenticated
 * navigation is redirected to /auth/sign-in, preserving the intended
 * destination in the `redirect` search param. Server functions must still
 * authorize themselves via ensureSession() — this UI guard alone is never
 * sufficient (review-framework invariant #7).
 *
 * The shell composition lives here too: every authenticated screen renders
 * inside the AppShell. The session arrives via router context — it is never
 * refetched by shell chrome.
 */
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"

import { AppShell } from "@/components/shell/app-shell"
import { safeRedirectPath } from "@/lib/redirect"
import { getSession } from "@/lib/session"

function GuardLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}

export const Route = createFileRoute("/_protected")({
  beforeLoad: async ({ location }) => {
    const session = await getSession()
    if (!session) {
      throw redirect({
        to: "/auth/sign-in",
        search: { redirect: safeRedirectPath(location.href) },
      })
    }
    return { session }
  },
  component: GuardLayout,
})
