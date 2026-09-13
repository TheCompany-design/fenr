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
import { z } from "zod"

import { AuthShell } from "@/features/auth"
import { safeRedirectPath } from "@/lib/redirect"
import { getSession } from "@/lib/session"

const searchSchema = z
  .object({
    redirect: z.string().optional(),
  })
  .passthrough()

export function getAuthTagline(pathname: string): string {
  if (pathname.includes("/sign-up")) {
    return "Create your account and start with a clean, focused canvas."
  }
  if (pathname.includes("/check-email")) {
    return "A quiet workspace for focused work."
  }
  return "A quiet workspace for focused work. Sign in to pick up where you left off."
}

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
  validateSearch: (search) => searchSchema.parse(search),
  beforeLoad: async ({ search }) => {
    const session = await getSession()
    if (session) {
      throw redirect({ href: safeRedirectPath(search.redirect) })
    }
  },
  component: AuthLayout,
})
