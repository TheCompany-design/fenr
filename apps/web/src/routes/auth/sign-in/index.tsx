/**
 * /auth/sign-in — public route for passwordless magic-link sign in.
 *
 * Session bouncing is handled at the parent /auth route.
 * The `redirect` search param is validated against open-redirects.
 */
import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import { AuthErrorBanner, AuthHeader, MagicLinkForm } from "@/features/auth"
import { safeRedirectPath } from "@/lib/redirect"

const searchSchema = z.object({
  redirect: z.string().optional(),
  error: z.string().optional(),
})

export const Route = createFileRoute("/auth/sign-in/")({
  validateSearch: (search) => searchSchema.parse(search),
  component: SignInPage,
})

function SignInPage() {
  const { redirect: redirectToParam, error } = Route.useSearch()
  const redirectTo = safeRedirectPath(redirectToParam)

  return (
    <>
      {error ? <AuthErrorBanner error={error} /> : null}

      <AuthHeader
        title="Sign in to Fenr"
        description="Enter your email to receive a passwordless sign-in link."
      />
      <MagicLinkForm redirectTo={redirectTo} />
      <footer className="mt-8 text-muted-foreground text-sm">
        New to Fenr? Entering your email will automatically create your account.
      </footer>
    </>
  )
}
