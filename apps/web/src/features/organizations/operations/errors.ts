/**
 * Custom error types for organization domain operations.
 */

export class ForbiddenError extends Error {
  constructor(message = "You do not have permission to perform this action") {
    super(message)
    this.name = "ForbiddenError"
  }
}

export class NotFoundError extends Error {
  constructor(message = "Resource not found") {
    super(message)
    this.name = "NotFoundError"
  }
}

export class ConflictError extends Error {
  constructor(message = "Resource already exists") {
    super(message)
    this.name = "ConflictError"
  }
}

export function isUniqueConstraintError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false
  const anyErr = err as Record<string, unknown>
  const code =
    anyErr.code ?? (anyErr.cause as Record<string, unknown> | undefined)?.code
  if (code === "23505") return true
  const msg = String(anyErr.message ?? "").toLowerCase()
  return (
    msg.includes("duplicate key") ||
    msg.includes("23505") ||
    msg.includes("unique constraint")
  )
}
