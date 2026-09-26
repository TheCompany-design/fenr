/**
 * Better Auth HTTP handler mounted at /api/auth/*.
 *
 * All auth traffic (sign-in, sign-up, sign-out, get-session, error paths)
 * flows through the single Better Auth handler. Cookies are attached via
 * the tanstackStartCookies plugin (see src/lib/auth.ts).
 */
import { createFileRoute } from "@tanstack/react-router"

import { auth } from "@/lib/auth"
import {
  extractOrGenerateRequestId,
  REQUEST_ID_HEADER,
} from "@/lib/http/request-id"
import { logger } from "@/lib/logger"

export async function handleAuthRequest(request: Request): Promise<Response> {
  const startTime = performance.now()
  const pathname = new URL(request.url).pathname
  const { requestId } = extractOrGenerateRequestId(request.headers)
  const mod = "api.auth"
  const action = pathname
  const method = request.method
  const timestamp = new Date().toISOString()

  let response: Response | undefined
  let errorDetails:
    | { name: string; message: string; stack?: string }
    | undefined

  try {
    const authResponse = await auth.handler(request)
    const responseHeaders = new Headers(authResponse.headers)
    responseHeaders.set(REQUEST_ID_HEADER, requestId)
    responseHeaders.set("Access-Control-Expose-Headers", REQUEST_ID_HEADER)
    response = new Response(authResponse.body, {
      status: authResponse.status,
      statusText: authResponse.statusText,
      headers: responseHeaders,
    })
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
      {
        status: 500,
        headers: {
          [REQUEST_ID_HEADER]: requestId,
          "Access-Control-Expose-Headers": REQUEST_ID_HEADER,
        },
      },
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
