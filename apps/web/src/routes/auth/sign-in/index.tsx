/**
 * /auth/sign-in — public route for passwordless magic-link sign in.
 *
 * Session bouncing is handled at the parent /auth route.
 * The `redirect` search param is validated against open-redirects.
 */
import { createFileRoute, Link } from "@tanstack/react-router"

import {
  AuthErrorBanner,
  AuthHeader,
  AuthMethods,
  useAuthError,
} from "@/features/auth"
import { safeRedirectPath } from "@/lib/navigation"
import { authSignInSearchSchema } from "@/lib/schemas/search"

export const Route = createFileRoute("/auth/sign-in/")({
  validateSearch: (search) => authSignInSearchSchema.parse(search),
  component: SignInPage,
})

function SignInPage() {
  const { redirect: redirectToParam, error } = Route.useSearch()
  const redirectTo = safeRedirectPath(redirectToParam)

  useAuthError(error)

  return (
    <>
      {error ? <AuthErrorBanner error={error} /> : null}

      <AuthHeader
        title="Sign in to Fenr"
        description="Enter your email to receive a passwordless sign-in link."
      />
      <AuthMethods redirectTo={redirectTo} />

      <footer className="mt-8 text-muted-foreground text-sm">
        Don&apos;t have an account?{" "}
        <Link
          to="/auth/sign-up"
          search={{ redirect: redirectTo }}
          className="text-foreground underline-offset-4 hover:underline"
        >
          Sign up
        </Link>
      </footer>
    </>
  )
}
