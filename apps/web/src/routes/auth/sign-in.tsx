/**
 * /auth/sign-in — public route for passwordless magic-link sign in.
 *
 * Signed-in visitors bounce back to the app. The `redirect` search param is
 * validated against open-redirects before being used for post-login nav.
 */
import { AlertCircleIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { createFileRoute, redirect } from "@tanstack/react-router"
import { z } from "zod"

import { AuthHeader, AuthShell, MagicLinkForm } from "@/features/auth"
import { safeRedirectPath } from "@/lib/redirect"
import { getSession } from "@/lib/session"

const searchSchema = z.object({
  redirect: z.string().optional(),
  error: z.string().optional(),
})

export const Route = createFileRoute("/auth/sign-in")({
  validateSearch: (search) => searchSchema.parse(search),
  beforeLoad: async ({ search }) => {
    const session = await getSession()
    if (session) {
      throw redirect({ href: safeRedirectPath(search.redirect) })
    }
  },
  component: SignInPage,
})

function SignInPage() {
  const { redirect: redirectToParam, error } = Route.useSearch()
  const redirectTo = safeRedirectPath(redirectToParam)

  return (
    <AuthShell tagline="A quiet workspace for focused work. Sign in to pick up where you left off.">
      {error && (
        <div
          role="alert"
          aria-live="polite"
          className="mb-6 flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-destructive text-sm"
        >
          <HugeiconsIcon
            icon={AlertCircleIcon}
            className="mt-0.5 size-5 shrink-0"
          />
          <div>
            <p className="font-semibold">Sign-in Link Issue</p>
            <p className="mt-1 text-muted-foreground text-xs leading-relaxed">
              Your sign-in link has expired, was already used, or is invalid.
              Please enter your email below to receive a fresh link.
            </p>
          </div>
        </div>
      )}

      <AuthHeader
        title="Sign in to Fenr"
        description="Enter your email to receive a passwordless sign-in link."
      />
      <MagicLinkForm redirectTo={redirectTo} />
      <footer className="mt-8 text-muted-foreground text-sm">
        New to Fenr? Entering your email will automatically create your account.
      </footer>
    </AuthShell>
  )
}
