/**
 * /auth — Top-level layout route for public authentication pages.
 *
 * Unifies:
 * 1. Session guard: Bounces authenticated visitors to their intended destination.
 * 2. Layout shell: Persists the split-screen brand panel across child page transitions.
 */
import {
  createFileRoute,
  Outlet,
  redirect,
  useMatches,
} from "@tanstack/react-router"
import { AuthShell, getAuthTagline } from "@/features/auth"
import { safeRedirectPath } from "@/lib/redirect"
import { authLayoutSearchSchema } from "@/lib/schemas/search"
import { getSession } from "@/lib/session"

function AuthLayout() {
  const matches = useMatches()
  const currentPath = matches[matches.length - 1]?.pathname ?? ""
  const tagline = getAuthTagline(currentPath)

  return (
    <AuthShell tagline={tagline}>
      <Outlet />
    </AuthShell>
  )
}

export const Route = createFileRoute("/auth")({
  validateSearch: (search) => authLayoutSearchSchema.parse(search),
  beforeLoad: async ({ search }) => {
    const session = await getSession()
    if (session) {
      throw redirect({ href: safeRedirectPath(search.redirect) })
    }
  },
  component: AuthLayout,
})
