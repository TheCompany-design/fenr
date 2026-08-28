/**
 * Sign-up form — TanStack Form + Zod wired to the Better Auth client.
 *
 * Better Auth signs the user in automatically after a successful sign-up,
 * so success navigates straight to the app. Failures surface as specific
 * non-leaky Sonner toasts.
 */
import { useForm } from "@tanstack/react-form"
import { useNavigate } from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Separator } from "@workspace/ui/components/separator"
import { toast } from "sonner"

import { authClient } from "@/lib/auth-client"
import { signUpSchema } from "../schemas/auth.schema"

import { FieldError } from "./field-error"
import { OAuthButtons } from "./oauth-buttons"
import { PasswordInput } from "./password-input"

/** Map Better Auth error codes to user-facing messages without leaking internals. */
function signUpErrorMessage(
  error: { code?: string | null } | null | undefined,
): string {
  switch (error?.code) {
    case "USER_ALREADY_EXISTS":
      return "An account with this email already exists. Try signing in instead."
    case "PASSWORD_TOO_SHORT":
    case "PASSWORD_TOO_LONG":
      return "Your password doesn't meet the length requirements (8–128 characters)."
    default:
      return "We couldn't create your account right now. Please try again in a moment."
  }
}

export function SignUpForm({ redirectTo }: { redirectTo: string }) {
  const navigate = useNavigate()

  const form = useForm({
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
    validators: {
      onChange: signUpSchema,
    },
    onSubmit: async ({ value }) => {
      const { error } = await authClient.signUp.email({
        name: value.name.trim(),
        email: value.email.trim(),
        password: value.password,
      })

      if (error) {
        toast.error("Sign-up failed", {
          description: signUpErrorMessage(error),
        })
        return
      }

      toast.success("Account created", { description: "Welcome to Fenr." })
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
        <form.Field name="name">
          {(field) => (
            <div className="flex flex-col gap-2">
              <Label htmlFor="sign-up-name">Name</Label>
              <Input
                id="sign-up-name"
                name={field.name}
                type="text"
                autoComplete="name"
                placeholder="Ada Lovelace"
                required
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
              />
              <FieldError field={field} />
            </div>
          )}
        </form.Field>

        <form.Field name="email">
          {(field) => (
            <div className="flex flex-col gap-2">
              <Label htmlFor="sign-up-email">Email</Label>
              <Input
                id="sign-up-email"
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
              <Label htmlFor="sign-up-password">Password</Label>
              <PasswordInput
                id="sign-up-password"
                name={field.name}
                autoComplete="new-password"
                placeholder="8+ chars, upper & lower case, number, symbol"
                required
                minLength={8}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
              />
              <FieldError field={field} />
            </div>
          )}
        </form.Field>

        <form.Field
          name="confirmPassword"
          validators={{
            // Re-run when the password changes so a later password edit also
            // re-validates the confirmation.
            onChangeListenTo: ["password"],
            onChange: ({ value, fieldApi }) =>
              value === fieldApi.form.state.values.password
                ? undefined
                : "Passwords do not match",
          }}
        >
          {(field) => (
            <div className="flex flex-col gap-2">
              <Label htmlFor="sign-up-confirm-password">Confirm password</Label>
              <PasswordInput
                id="sign-up-confirm-password"
                name={field.name}
                autoComplete="new-password"
                placeholder="Repeat your password"
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
              {isSubmitting ? "Creating account…" : "Create account"}
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
