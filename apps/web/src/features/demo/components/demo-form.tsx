import { type AnyFieldApi, useForm } from "@tanstack/react-form"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { demoFormSchema } from "../schemas/demo-form.schema"

/**
 * Fenr convention: ALL forms use TanStack Form + Zod (Standard Schema).
 * Schemas are colocated in features/<name>/schemas and passed directly as validators.
 */
export function DemoForm() {
  const form = useForm({
    defaultValues: {
      name: "",
      email: "",
      message: "",
    },
    validators: {
      onChange: demoFormSchema,
    },
    onSubmit: async ({ value }) => {
      console.info("form submitted", value)
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>TanStack Form + Zod</CardTitle>
        <CardDescription>
          Validation runs through the shared Zod schema on every change.
        </CardDescription>
      </CardHeader>
      <CardContent>
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
                <Label htmlFor={field.name}>Name</Label>
                <Input
                  id={field.name}
                  name={field.name}
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
                <Label htmlFor={field.name}>Email</Label>
                <Input
                  id={field.name}
                  name={field.name}
                  type="email"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                <FieldError field={field} />
              </div>
            )}
          </form.Field>

          <form.Field name="message">
            {(field) => (
              <div className="flex flex-col gap-2">
                <Label htmlFor={field.name}>Message</Label>
                <Input
                  id={field.name}
                  name={field.name}
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
              <Button type="submit" disabled={!canSubmit}>
                {isSubmitting ? "Submitting…" : "Submit"}
              </Button>
            )}
          </form.Subscribe>
        </form>
      </CardContent>
    </Card>
  )
}

function FieldError({ field }: { field: AnyFieldApi }) {
  const { isTouched, isValidating, errors } = field.state.meta
  if (!isTouched || isValidating || errors.length === 0) return null
  return (
    <p className="text-destructive text-sm">
      {errors[0]?.message ?? "Invalid"}
    </p>
  )
}
