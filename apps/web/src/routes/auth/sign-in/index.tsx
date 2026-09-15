/**
 * /auth/sign-in — public route for passwordless magic-link sign in.
 *
 * Session bouncing is handled at the parent /auth route.
 * The `redirect` search param is validated against open-redirects.
 */
import { createFileRoute } from "@tanstack/react-router"
import { useEffect } from "react"
import { toast } from "sonner"

import {
  AuthErrorBanner,
  AuthHeader,
  getAuthErrorMessage,
  MagicLinkForm,
} from "@/features/auth"
import { safeRedirectPath } from "@/lib/redirect"
import { authSignInSearchSchema } from "@/lib/schemas/search"

export const Route = createFileRoute("/auth/sign-in/")({
  validateSearch: (search) => authSignInSearchSchema.parse(search),
  component: SignInPage,
})

function SignInPage() {
  const { redirect: redirectToParam, error } = Route.useSearch()
  const redirectTo = safeRedirectPath(redirectToParam)

  useEffect(() => {
    if (error) {
      const errInfo = getAuthErrorMessage(error)
      toast.error(errInfo.title, {
        description: errInfo.description,
      })
    }
  }, [error])

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
