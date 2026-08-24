/**
 * /auth/sign-up — public route.
 *
 * Signed-in visitors bounce back to the app; the `redirect` search param is
 * validated against open-redirects before use.
 */

import { createFileRoute, redirect } from "@tanstack/react-router"
import { z } from "zod"

import { AuthHeader, AuthShell } from "@/features/auth/auth-shell"
import { SignUpForm } from "@/features/auth/sign-up-form"
import { safeRedirectPath } from "@/lib/redirect"
import { getSession } from "@/lib/session"

const searchSchema = z.object({
  redirect: z.string().optional(),
})

export const Route = createFileRoute("/auth/sign-up")({
  validateSearch: (search) => searchSchema.parse(search),
  beforeLoad: async () => {
    const session = await getSession()
    if (session) {
      throw redirect({ to: "/" })
    }
  },
  component: SignUpPage,
})

function SignUpPage() {
  const { redirect: redirectToParam } = Route.useSearch()
  const redirectTo = safeRedirectPath(redirectToParam)

  return (
    <AuthShell tagline="Create your account and start with a clean, focused canvas.">
      <AuthHeader
        title="Create your account"
        description="It takes less than a minute."
      />
      <SignUpForm redirectTo={redirectTo} />
      <footer className="mt-8 text-muted-foreground text-sm">
        Already have an account?{" "}
        <Route.Link
          to="/auth/sign-in"
          search={{ redirect: redirectTo }}
          className="text-foreground underline-offset-4 hover:underline"
        >
          Sign in
        </Route.Link>
      </footer>
    </AuthShell>
  )
}
