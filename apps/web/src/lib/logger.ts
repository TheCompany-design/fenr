/**
 * Structured logging via Pino.
 *
 * SERVER-ONLY: never import from client components/hooks — Pino writes to
 * stdout and must not be bundled for the browser.
 *
 * Conventions (/logging-best-practices):
 * - One child logger per module via `moduleLogger("<name>")`.
 * - Log structured fields, not string interpolation.
 * - Never log secrets (passwords, tokens, cookies, connection strings).
 * - Levels: error = needs action now, warn = degraded but serving,
 *   info = meaningful state transitions, debug = diagnostics.
 */
import pino from "pino"

const logLevel =
  typeof window !== "undefined" ? "info" : (process.env.LOG_LEVEL ?? "info")

export const logger = pino({
  level: logLevel,
  base: { app: "fenr" },
  browser: typeof window !== "undefined" ? { asObject: true } : undefined,
  redact: {
    paths: [
      "password",
      "token",
      "secret",
      "*.password",
      "*.token",
      "*.secret",
      "headers.authorization",
      "headers.cookie",
    ],
    censor: "[REDACTED]",
  },
})

export function moduleLogger(mod: string): pino.Logger {
  return logger.child({ mod })
}

export interface WideEventContext {
  userId?: string | null
  organizationId?: string | null
  status_code?: number
  [key: string]: unknown
}

export async function withWideEvent<T>(
  mod: string,
  action: string,
  fn: (setContext: (ctx: Partial<WideEventContext>) => void) => Promise<T>,
  initialContext?: Partial<WideEventContext>,
): Promise<T> {
  const startTime = performance.now()
  const requestId =
    typeof initialContext?.requestId === "string"
      ? initialContext.requestId
      : crypto.randomUUID()
  const timestamp = new Date().toISOString()

  const context: WideEventContext = { ...initialContext }
  const setContext = (ctx: Partial<WideEventContext>) => {
    Object.assign(context, ctx)
  }

  let outcome: "success" | "error" = "success"
  let statusCode: number | undefined
  let errorDetails:
    | { name: string; message: string; stack?: string }
    | undefined

  try {
    const result = await fn(setContext)
    outcome = "success"
    statusCode = context.status_code ?? 200
    return result
  } catch (error) {
    outcome = "error"
    const err = error as {
      name?: string
      message?: string
      issues?: unknown
      status?: number
      statusCode?: number
    }
    const errStatus =
      typeof err?.status === "number"
        ? err.status
        : typeof err?.statusCode === "number"
          ? err.statusCode
          : undefined

    if (err?.name === "UnauthorizedError") {
      statusCode = 401
    } else if (err?.name === "ForbiddenError") {
      statusCode = 403
    } else if (err?.name === "NotFoundError") {
      statusCode = 404
    } else if (err?.name === "ConflictError") {
      statusCode = 409
    } else if (
      err?.name === "ZodError" ||
      (err && typeof err === "object" && "issues" in err)
    ) {
      statusCode = 400
    } else if (typeof errStatus === "number" && errStatus >= 400) {
      statusCode = errStatus
    } else {
      statusCode =
        typeof context.status_code === "number" && context.status_code >= 400
          ? context.status_code
          : 500
    }

    if (error instanceof Error) {
      errorDetails = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      }
    } else {
      errorDetails = {
        name: typeof err?.name === "string" ? err.name : "Error",
        message: typeof err?.message === "string" ? err.message : String(error),
      }
    }

    throw error
  } finally {
    const duration_ms = Math.max(0, Math.round(performance.now() - startTime))
    const finalStatusCode = statusCode ?? (outcome === "success" ? 200 : 500)
    const event: Record<string, unknown> = {
      ...context,
      service: "fenr",
      mod,
      action,
      requestId,
      timestamp,
      duration_ms,
      status_code: finalStatusCode,
      outcome,
      ...(errorDetails ? { error: errorDetails } : {}),
    }

    const message =
      outcome === "error"
        ? `[${mod}] ${action} failed`
        : `[${mod}] ${action} completed`

    try {
      if (outcome === "error" && finalStatusCode >= 500) {
        logger.error(event, message)
      } else {
        logger.info(event, message)
      }
    } catch {
      // Defensive logging: logging failures must not mask or replace user errors or return values
    }
  }
}
