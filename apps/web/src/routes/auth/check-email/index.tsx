/**
 * /auth/check-email — public route displaying the magic link confirmation screen.
 *
 * Session bouncing is handled at the parent /auth route.
 * Missing email bounces back to /auth/sign-in.
 */
import { createFileRoute, redirect } from "@tanstack/react-router"

import { CheckEmailCard } from "@/features/auth"
import { safeRedirectPath } from "@/lib/redirect"
import { authCheckEmailSearchSchema } from "@/lib/schemas/search"

export const Route = createFileRoute("/auth/check-email/")({
  validateSearch: (search) => authCheckEmailSearchSchema.parse(search),
  beforeLoad: ({ search }) => {
    if (!search.email?.trim()) {
      throw redirect({
        to: "/auth/sign-in",
        search: {
          redirect: search.redirect,
          error: search.error,
        },
      })
    }
  },
  component: CheckEmailPage,
})

function CheckEmailPage() {
  const { email, redirect: redirectToParam, error } = Route.useSearch()
  const redirectTo = safeRedirectPath(redirectToParam)

  return (
    <CheckEmailCard
      key={`${email}:${error ?? ""}`}
      email={email}
      redirectTo={redirectTo}
      errorReason={error}
    />
  )
}
