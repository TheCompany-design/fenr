/**
 * Sign-in form — TanStack Form + Zod wired to the Better Auth client.
 *
 * Failure handling: known credential failures get a specific, non-leaky
 * toast; everything else degrades to a generic retry message. Raw internals
 * are never surfaced to the user.
 */
import { useForm } from "@tanstack/react-form"
import { useNavigate } from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Separator } from "@workspace/ui/components/separator"
import { toast } from "sonner"

import { authClient } from "@/lib/auth-client"
import { signInSchema } from "@/lib/schemas/auth"

import { FieldError } from "./field-error"
import { OAuthButtons } from "./oauth-buttons"
import { PasswordInput } from "./password-input"

/** Map Better Auth error codes to user-facing messages without leaking internals. */
function signInErrorMessage(
  error: { code?: string | null } | null | undefined,
): string {
  switch (error?.code) {
    case "INVALID_EMAIL_OR_PASSWORD":
    case "USER_NOT_FOUND":
      // Same message for unknown user and wrong password — avoids enumeration.
      return "Invalid email or password."
    case "EMAIL_NOT_VERIFIED":
      return "Verify your email address first — check your inbox for the link."
    default:
      return "We couldn't sign you in right now. Please try again in a moment."
  }
}

export function SignInForm({ redirectTo }: { redirectTo: string }) {
  const navigate = useNavigate()

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
    validators: {
      onChange: signInSchema,
    },
    onSubmit: async ({ value }) => {
      const { error } = await authClient.signIn.email({
        email: value.email.trim(),
        password: value.password,
      })

      if (error) {
        toast.error("Sign-in failed", {
          description: signInErrorMessage(error),
        })
        return
      }

      toast.success("Welcome back")
      await navigate({ href: redirectTo })
    },
  })

  return (
    <section className="flex flex-col gap-6">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          e.stopPropagation()
          form.handleSubmit()
        }}
      >
        <form.Field name="email">
          {(field) => (
            <div className="flex flex-col gap-2">
              <Label htmlFor="sign-in-email">Email</Label>
              <Input
                id="sign-in-email"
                name={field.name}
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
              />
              <FieldError field={field} />
            </div>
          )}
        </form.Field>

        <form.Field name="password">
          {(field) => (
            <div className="flex flex-col gap-2">
              <Label htmlFor="sign-in-password">Password</Label>
              <PasswordInput
                id="sign-in-password"
                name={field.name}
                autoComplete="current-password"
                placeholder="••••••••"
                required
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
              />
              <FieldError field={field} />
            </div>
          )}
        </form.Field>

        <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting]}>
          {([canSubmit, isSubmitting]) => (
            <Button
              type="submit"
              size="lg"
              disabled={!canSubmit || isSubmitting}
            >
              {isSubmitting ? "Signing in…" : "Sign in"}
            </Button>
          )}
        </form.Subscribe>
      </form>

      <div className="my-1 flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground uppercase">
          or
        </span>
        <Separator className="flex-1" />
      </div>

      <OAuthButtons />
    </section>
  )
}
