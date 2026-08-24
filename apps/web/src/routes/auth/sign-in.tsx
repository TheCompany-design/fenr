/**
 * /auth/sign-in — public route.
 *
 * Signed-in visitors bounce back to the app. The `redirect` search param is
 * validated against open-redirects before being used for post-login nav.
 */

import { createFileRoute, redirect } from "@tanstack/react-router"
import { z } from "zod"

import { AuthHeader, AuthShell } from "@/features/auth/auth-shell"
import { SignInForm } from "@/features/auth/sign-in-form"
import { safeRedirectPath } from "@/lib/redirect"
import { getSession } from "@/lib/session"

const searchSchema = z.object({
  redirect: z.string().optional(),
})

export const Route = createFileRoute("/auth/sign-in")({
  validateSearch: (search) => searchSchema.parse(search),
  beforeLoad: async () => {
    const session = await getSession()
    if (session) {
      throw redirect({ to: "/" })
    }
  },
  component: SignInPage,
})

function SignInPage() {
  const { redirect: redirectToParam } = Route.useSearch()
  const redirectTo = safeRedirectPath(redirectToParam)

  return (
    <AuthShell tagline="A quiet workspace for focused work. Sign in to pick up where you left off.">
      <AuthHeader title="Enter your orbit" description="Sign in to continue." />
      <SignInForm redirectTo={redirectTo} />
      <footer className="mt-8 text-muted-foreground text-sm">
        No account yet?{" "}
        <Route.Link
          to="/auth/sign-up"
          search={{ redirect: redirectTo }}
          className="text-foreground underline-offset-4 hover:underline"
        >
          Create one
        </Route.Link>
      </footer>
    </AuthShell>
  )
}
