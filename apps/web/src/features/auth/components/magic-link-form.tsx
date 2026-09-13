/**
 * Magic link sign-in/sign-up form — TanStack Form + Zod wired to Better Auth magicLinkClient.
 *
 * Emits email-only authentication links. Raw errors are caught and surfaced via Sonner.
 */
import { Mail01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useForm } from "@tanstack/react-form"
import { useNavigate } from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { toast } from "sonner"

import { authClient } from "@/lib/auth-client"
import { magicLinkSchema } from "../schemas/auth.schema"
import { FieldError } from "./field-error"

export interface MagicLinkFormProps {
  redirectTo: string
  defaultEmail?: string
}

export function MagicLinkForm({
  redirectTo,
  defaultEmail = "",
}: MagicLinkFormProps) {
  const navigate = useNavigate()

  const form = useForm({
    defaultValues: {
      email: defaultEmail,
    },
    validators: {
      onChange: magicLinkSchema,
    },
    onSubmit: async ({ value }) => {
      const email = value.email.trim()

      let success = false
      try {
        const result = await authClient.signIn.magicLink({
          email,
          callbackURL: redirectTo || "/",
        })

        if (result.error) {
          toast.error("Could not send magic link", {
            description:
              result.error.message ||
              "Please verify your email address and try again.",
          })
          return
        }

        toast.success("Magic link sent", {
          description: "Check your inbox to sign in.",
        })
        success = true
      } catch (_error) {
        toast.error("Network error", {
          description:
            "Unable to reach the authentication service. Please check your connection and try again.",
        })
        return
      }

      if (success) {
        await navigate({
          to: "/auth/check-email",
          search: {
            email,
            redirect: redirectTo,
          },
        })
      }
    },
  })

  return (
    <form
      action="javascript:void(0);"
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        form.handleSubmit()
      }}
    >
      <form.Field name="email">
        {(field) => {
          const hasError =
            field.state.meta.errors.length > 0 && field.state.meta.isTouched
          return (
            <div className="flex flex-col gap-2">
              <Label htmlFor="magic-link-email">Email</Label>
              <Input
                id="magic-link-email"
                name={field.name}
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
                aria-invalid={hasError}
                aria-describedby={
                  hasError ? "magic-link-email-error" : undefined
                }
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
              />
              <FieldError field={field} id="magic-link-email-error" />
            </div>
          )
        }}
      </form.Field>

      <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting]}>
        {([canSubmit, isSubmitting]) => (
          <Button
            type="submit"
            size="lg"
            disabled={!canSubmit || isSubmitting}
            className="w-full gap-2"
          >
            <HugeiconsIcon icon={Mail01Icon} className="size-4" />
            {isSubmitting ? "Sending link…" : "Continue with email"}
          </Button>
        )}
      </form.Subscribe>
    </form>
  )
}
