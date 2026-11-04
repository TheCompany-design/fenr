export const NABU_START_TURN_PATH = "/api/v1/threads/turns"
export const NABU_RESUME_TURN_PATH = (turnId: string) =>
  `/api/v1/threads/${encodeURIComponent(turnId)}/resume`

import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { serverEnv } from "@/lib/env"
import {
  extractOrGenerateRequestId,
  REQUEST_ID_HEADER,
} from "@/lib/http/request-id"
import { acquireOutboundJwt } from "@/lib/http/token.server"
import { logger } from "@/lib/logger"

const resumeTurnPayloadSchema = z.object({
  resume_turn_id: z.string().uuid(),
  thread_id: z.string().uuid().optional(),
})

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

    const session = await auth.api.getSession({ headers: request.headers })
    if (!session?.user?.id) {
      response = jsonErrorResponse("Unauthorized", 401, requestId)
      return response
    }

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

    if (!payload || typeof payload !== "object") {
      response = jsonErrorResponse("Invalid prompt payload", 400, requestId)
      return response
    }

    const isResumeRequest = "resume_turn_id" in payload
    let upstreamPath = NABU_START_TURN_PATH
    let upstreamBody: string | undefined

    if (isResumeRequest) {
      const parsedResume = resumeTurnPayloadSchema.safeParse(payload)
      if (!parsedResume.success) {
        response = jsonErrorResponse(
          "Invalid resume_turn_id payload",
          400,
          requestId,
        )
        return response
      }
      upstreamPath = NABU_RESUME_TURN_PATH(parsedResume.data.resume_turn_id)
      upstreamBody = undefined
    } else if (
      !("prompt" in payload) ||
      typeof (payload as { prompt: unknown }).prompt !== "string" ||
      !(payload as { prompt: string }).prompt.trim()
    ) {
      response = jsonErrorResponse("Invalid prompt payload", 400, requestId)
      return response
    } else {
      upstreamBody = JSON.stringify(payload)
    }

    const token = await acquireOutboundJwt(
      { type: "authenticated", service: "nabu", audience: "nabu" },
      { headersSource: request.headers },
    )

    const nabuUrl = `${serverEnv.NABU_SERVER_URL.replace(/\/+$/, "")}${upstreamPath}`
    const nabuResponse = await fetch(nabuUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(upstreamBody ? { "Content-Type": "application/json" } : {}),
        Accept: "text/event-stream",
        "X-Request-Id": requestId,
      },
      ...(upstreamBody ? { body: upstreamBody } : {}),
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
