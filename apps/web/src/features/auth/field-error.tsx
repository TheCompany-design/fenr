import type { AnyFieldApi } from "@tanstack/react-form"

/** Shared inline field-error renderer for TanStack Form fields. */
export function FieldError({ field }: { field: AnyFieldApi }) {
  const { isTouched, isValidating, errors } = field.state.meta
  if (!isTouched || isValidating || errors.length === 0) return null
  const message =
    errors[0] instanceof Error
      ? errors[0].message
      : ((errors[0]?.message as string | undefined) ?? "Invalid value")
  return (
    <p className="text-destructive text-sm" role="alert">
      {message}
    </p>
  )
}
