import type { AnyFieldApi } from "@tanstack/react-form"

export function FieldError({ field, id }: { field: AnyFieldApi; id?: string }) {
  const { isTouched, isValidating, errors } = field.state.meta
  if (!isTouched || isValidating || errors.length === 0) return null

  const first = errors[0]
  const message =
    typeof first === "string"
      ? first
      : first instanceof Error
        ? first.message
        : ((first?.message as string | undefined) ?? "Invalid value")
  return (
    <p id={id} className="text-destructive text-sm" role="alert">
      {message}
    </p>
  )
}
