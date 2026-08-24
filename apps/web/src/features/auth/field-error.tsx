import type { AnyFieldApi } from "@tanstack/react-form"

/** Shared inline field-error renderer for TanStack Form fields. */
export function FieldError({ field }: { field: AnyFieldApi }) {
  const { isTouched, isValidating, errors } = field.state.meta
  if (!isTouched || isValidating || errors.length === 0) return null

  // Validator results come in three shapes: plain strings from function
  // validators, { message } objects from Standard Schema issues, and Errors.
  const first = errors[0]
  const message =
    typeof first === "string"
      ? first
      : first instanceof Error
        ? first.message
        : ((first?.message as string | undefined) ?? "Invalid value")
  return (
    <p className="text-destructive text-sm" role="alert">
      {message}
    </p>
  )
}
