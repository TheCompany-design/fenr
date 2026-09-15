/**
 * /auth/sign-up — public route for passwordless registration.
 *
 * Session bouncing is handled at the parent /auth route.
 * Entering an email automatically creates and verifies the account.
 */
import { createFileRoute, Link } from "@tanstack/react-router"

import { AuthHeader, MagicLinkForm } from "@/features/auth"
import { safeRedirectPath } from "@/lib/redirect"
import { authSignUpSearchSchema } from "@/lib/schemas/search"

export const Route = createFileRoute("/auth/sign-up/")({
  validateSearch: (search) => authSignUpSearchSchema.parse(search),
  component: SignUpPage,
})

function SignUpPage() {
  const { redirect: redirectToParam } = Route.useSearch()
  const redirectTo = safeRedirectPath(redirectToParam)

  return (
    <>
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
    </>
  )
}
