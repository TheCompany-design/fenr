/**
 * /auth/check-email — public route displaying the magic link confirmation screen.
 */
import { createFileRoute, redirect } from "@tanstack/react-router"
import { z } from "zod"

import { AuthShell, CheckEmailCard } from "@/features/auth"
import { safeRedirectPath } from "@/lib/redirect"
import { getSession } from "@/lib/session"

const searchSchema = z.object({
  email: z.string().default(""),
  redirect: z.string().optional(),
  error: z.string().optional(),
})

export const Route = createFileRoute("/auth/check-email")({
  validateSearch: (search) => searchSchema.parse(search),
  beforeLoad: async ({ search }) => {
    const session = await getSession()
    if (session) {
      throw redirect({ href: safeRedirectPath(search.redirect) })
    }

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
    <AuthShell tagline="A quiet workspace for focused work.">
      <CheckEmailCard
        email={email}
        redirectTo={redirectTo}
        errorReason={error}
      />
    </AuthShell>
  )
}
