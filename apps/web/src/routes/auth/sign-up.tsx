/**
 * /auth/sign-up — public route for passwordless registration.
 *
 * In email-only authentication, entering an email automatically creates
 * and verifies the account upon link click.
 */
import { createFileRoute, Link, redirect } from "@tanstack/react-router"
import { z } from "zod"

import { AuthHeader, AuthShell, MagicLinkForm } from "@/features/auth"
import { safeRedirectPath } from "@/lib/redirect"
import { getSession } from "@/lib/session"

const searchSchema = z.object({
  redirect: z.string().optional(),
})

export const Route = createFileRoute("/auth/sign-up")({
  validateSearch: (search) => searchSchema.parse(search),
  beforeLoad: async ({ search }) => {
    const session = await getSession()
    if (session) {
      throw redirect({ href: safeRedirectPath(search.redirect) })
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
        title="Get started with Fenr"
        description="Enter your email to receive a passwordless sign-in link."
      />
      <MagicLinkForm redirectTo={redirectTo} />
      <footer className="mt-8 text-muted-foreground text-sm">
        Already have an account?{" "}
        <Link
          to="/auth/sign-in"
          search={{ redirect: redirectTo }}
          className="text-foreground underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </footer>
    </AuthShell>
  )
}
