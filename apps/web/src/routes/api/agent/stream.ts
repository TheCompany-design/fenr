/**
 * TanStack Start BFF Zero-Buffering SSE Proxy Route.
 *
 * Authenticates user session, mints a short-lived outbound JWT with tenant context
 * (audience: "nabu"), and pipes the upstream SSE stream directly to the browser
 * with zero buffering and wide-event observability.
 *
 * The upstream path is the one the agent runtime actually serves. It used to be
 * `POST /api/v1/agent/run`, which the runtime no longer routes: every request
 * answered 404 and chat failed at the first turn. A turn is now started with
 * `POST /api/v1/threads/turns`, and the rest of the surface is keyed by turn id:
 *
 *   POST   /api/v1/threads/{turn_id}/approvals   record a decision
 *   POST   /api/v1/threads/{turn_id}/cancel      stop a turn
 *   POST   /api/v1/threads/{turn_id}/resume      resume a suspended turn
 *   GET    /api/v1/threads/{turn_id}/items       replay the transcript
 *   GET    /api/v1/capabilities                  what a turn may do
 *
 * Keep this in step with `thebookofnabu`'s `routes::api_v1_router`; the route
 * table there is the only authority for what exists.
 */

/** Where a turn is started upstream. Mirrors `api_v1_router` in the runtime. */
export const NABU_START_TURN_PATH = "/api/v1/threads/turns"

import { createFileRoute } from "@tanstack/react-router"
import { auth } from "@/lib/auth"
import { serverEnv } from "@/lib/env"
import {
  extractOrGenerateRequestId,
  REQUEST_ID_HEADER,
} from "@/lib/http/request-id"
import { acquireOutboundJwt } from "@/lib/http/token.server"
import { logger } from "@/lib/logger"

function jsonErrorResponse(
  error: string,
  status: number,
  requestId: string,
  extraHeaders?: Record<string, string>,
): Response {
  return Response.json(
    { error },
    {
      status,
      headers: {
        [REQUEST_ID_HEADER]: requestId,
        "Access-Control-Expose-Headers": REQUEST_ID_HEADER,
        ...extraHeaders,
      },
    },
  )
}

export async function handleAgentStreamRequest(
  request: Request,
): Promise<Response> {
  const startTime = performance.now()
  const pathname = "/api/agent/stream"
  const { requestId } = extractOrGenerateRequestId(request.headers)
  const mod = "api.agent.stream"
  const method = request.method
  const timestamp = new Date().toISOString()

  let response: Response | undefined
  let errorDetails:
    | { name: string; message: string; stack?: string }
    | undefined
  let tenantId: string | undefined

  try {
    if (method !== "POST") {
      response = jsonErrorResponse("Method not allowed", 405, requestId, {
        Allow: "POST",
      })
      return response
    }

    // 1. Authenticate user session
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session?.user?.id) {
      response = jsonErrorResponse("Unauthorized", 401, requestId)
      return response
    }

    // 2. Enforce active organization tenant context
    const activeOrgId = session.session?.activeOrganizationId
    if (!activeOrgId) {
      response = jsonErrorResponse(
        "Tenant context required: active organization context is missing",
        403,
        requestId,
      )
      return response
    }
    tenantId = activeOrgId

    // 3. Validate request payload
    let bodyText = ""
    try {
      bodyText = await request.text()
    } catch {
      response = jsonErrorResponse("Invalid request body", 400, requestId)
      return response
    }

    let payload: unknown
    try {
      payload = JSON.parse(bodyText)
    } catch {
      response = jsonErrorResponse("Malformed JSON payload", 400, requestId)
      return response
    }

    if (
      !payload ||
      typeof payload !== "object" ||
      !("prompt" in payload) ||
      typeof (payload as { prompt: unknown }).prompt !== "string" ||
      !(payload as { prompt: string }).prompt.trim()
    ) {
      response = jsonErrorResponse("Invalid prompt payload", 400, requestId)
      return response
    }

    // 4. Mint outbound JWT for Nabu
    const token = await acquireOutboundJwt(
      { type: "authenticated", service: "nabu", audience: "nabu" },
      { headersSource: request.headers },
    )

    // 5. Connect to upstream Nabu SSE runtime
    const nabuUrl = `${serverEnv.NABU_SERVER_URL.replace(/\/+$/, "")}${NABU_START_TURN_PATH}`
    const nabuResponse = await fetch(nabuUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        "X-Request-Id": requestId,
      },
      body: JSON.stringify(payload),
      // @ts-expect-error duplex required for streaming request body in Bun/Node
      duplex: "half",
      signal: request.signal,
    })

    if (!nabuResponse.ok || !nabuResponse.body) {
      const status = nabuResponse.status >= 500 ? 502 : nabuResponse.status
      response = jsonErrorResponse(
        "Agent runtime unavailable",
        status,
        requestId,
      )
      return response
    }

    // 6. Pipe stream directly to browser with zero buffering
    response = new Response(nabuResponse.body, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
        [REQUEST_ID_HEADER]: requestId,
        "Access-Control-Expose-Headers": REQUEST_ID_HEADER,
      },
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
    response = jsonErrorResponse("Internal Server Error", 500, requestId)
    return response
  } finally {
    const duration_ms = Math.max(0, Math.round(performance.now() - startTime))
    const statusCode = response?.status ?? 500
    const outcome = statusCode < 400 ? "success" : "error"

    const event: Record<string, unknown> = {
      service: "fenr",
      mod,
      action: pathname,
      method,
      requestId,
      timestamp,
      status_code: statusCode,
      outcome,
      duration_ms,
      ...(tenantId ? { tenantId } : {}),
      ...(errorDetails ? { error: errorDetails } : {}),
    }

    const message =
      outcome === "error"
        ? `[${mod}] ${pathname} failed`
        : `[${mod}] ${pathname} completed`

    try {
      if (outcome === "error" && statusCode >= 500) {
        logger.error(event, message)
      } else {
        logger.info(event, message)
      }
    } catch {
      // Defensive logging: logging failures must not displace response
    }
  }
}

export const Route = createFileRoute("/api/agent/stream")({
  server: {
    handlers: {
      POST: ({ request }: { request: Request }) =>
        handleAgentStreamRequest(request),
    },
  },
})
