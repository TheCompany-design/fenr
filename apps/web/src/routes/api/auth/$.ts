/**
 * Better Auth HTTP handler mounted at /api/auth/*.
 *
 * All auth traffic (sign-in, sign-up, sign-out, get-session, error paths)
 * flows through the single Better Auth handler. Cookies are attached via
 * the tanstackStartCookies plugin (see src/lib/auth.ts).
 */
import { createFileRoute } from "@tanstack/react-router"

import { auth } from "@/lib/auth"
import { logger } from "@/lib/logger"

export async function handleAuthRequest(request: Request): Promise<Response> {
  const startTime = performance.now()
  const pathname = new URL(request.url).pathname
  const requestId = request.headers.get("x-request-id") || crypto.randomUUID()
  const mod = "api.auth"
  const action = pathname
  const method = request.method
  const timestamp = new Date().toISOString()

  let response: Response | undefined
  let errorDetails:
    | { name: string; message: string; stack?: string }
    | undefined

  try {
    response = await auth.handler(request)
    return response
  } catch (error) {
    if (error instanceof Error) {
      errorDetails = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      }
    } else {
      errorDetails = { name: "Error", message: String(error) }
    }
    response = Response.json(
      { message: "Internal Server Error" },
      { status: 500 },
    )
    return response
  } finally {
    const duration_ms = Math.max(0, Math.round(performance.now() - startTime))
    const statusCode = response?.status ?? 500
    const outcome = statusCode < 400 ? "success" : "error"

    const event: Record<string, unknown> = {
      service: "fenr",
      mod,
      action,
      method,
      requestId,
      timestamp,
      status_code: statusCode,
      outcome,
      duration_ms,
      ...(errorDetails ? { error: errorDetails } : {}),
    }

    const message =
      outcome === "error"
        ? `[${mod}] ${action} failed`
        : `[${mod}] ${action} completed`

    try {
      if (outcome === "error" && statusCode >= 500) {
        logger.error(event, message)
      } else {
        logger.info(event, message)
      }
    } catch {
      // Defensive logging: logging failures must not displace return values
    }
  }
}

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }: { request: Request }) => handleAuthRequest(request),
      POST: ({ request }: { request: Request }) => handleAuthRequest(request),
    },
  },
})
