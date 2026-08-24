/**
 * Pathless guard layout for the whole authenticated app area.
 *
 * Every nested route (including /) requires a valid session: unauthenticated
 * navigation is redirected to /auth/sign-in, preserving the intended
 * destination in the `redirect` search param. Server functions must still
 * authorize themselves via ensureSession() — this UI guard alone is never
 * sufficient (review-framework invariant #7).
 */
import { createFileRoute, redirect } from "@tanstack/react-router"
import { safeRedirectPath } from "@/lib/redirect"
import { getSession } from "@/lib/session"

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
})
