/**
 * TanStack Start BFF Zero-Buffering SSE Proxy Route.
 *
 * Authenticates user session, mints a short-lived outbound JWT with tenant context
 * (audience: "nabu"), and pipes the upstream SSE stream directly to the browser
 * with zero buffering and wide-event observability.
 */

import { createFileRoute } from "@tanstack/react-router"
import { auth } from "@/lib/auth"
import { serverEnv } from "@/lib/env"
import { acquireOutboundJwt } from "@/lib/http/token.server"
import { logger } from "@/lib/logger"

export async function handleAgentStreamRequest(
  request: Request,
): Promise<Response> {
  const startTime = performance.now()
  const pathname = "/api/agent/stream"
  const requestId = request.headers.get("x-request-id") || crypto.randomUUID()
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
      response = Response.json(
        { error: "Method not allowed" },
        { status: 405, headers: { Allow: "POST" } },
      )
      return response
    }

    // 1. Authenticate user session
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session?.user?.id) {
      response = Response.json({ error: "Unauthorized" }, { status: 401 })
      return response
    }

    // 2. Enforce active organization tenant context
    const activeOrgId = session.session?.activeOrganizationId
    if (!activeOrgId) {
      response = Response.json(
        {
          error:
            "Tenant context required: active organization context is missing",
        },
        { status: 403 },
      )
      return response
    }
    tenantId = activeOrgId

    // 3. Validate request payload
    let bodyText = ""
    try {
      bodyText = await request.text()
    } catch {
      response = Response.json(
        { error: "Invalid request body" },
        { status: 400 },
      )
      return response
    }

    let payload: unknown
    try {
      payload = JSON.parse(bodyText)
    } catch {
      response = Response.json(
        { error: "Malformed JSON payload" },
        { status: 400 },
      )
      return response
    }

    if (
      !payload ||
      typeof payload !== "object" ||
      !("prompt" in payload) ||
      typeof (payload as { prompt: unknown }).prompt !== "string" ||
      !(payload as { prompt: string }).prompt.trim()
    ) {
      response = Response.json(
        { error: "Invalid prompt payload" },
        { status: 400 },
      )
      return response
    }

    // 4. Mint outbound JWT for Nabu
    const token = await acquireOutboundJwt(
      { type: "authenticated", service: "nabu", audience: "nabu" },
      { headersSource: request.headers },
    )

    // 5. Connect to upstream Nabu SSE runtime
    const nabuUrl = `${serverEnv.NABU_SERVER_URL.replace(/\/+$/, "")}/api/v1/agent/run`
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
      response = Response.json(
        { error: "Agent runtime unavailable" },
        { status },
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
    response = Response.json(
      { error: "Internal Server Error" },
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
