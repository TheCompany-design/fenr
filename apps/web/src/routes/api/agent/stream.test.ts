import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { auth } from "@/lib/auth"
import { logger } from "@/lib/logger"
import { handleAgentStreamRequest } from "./stream"

describe("handleAgentStreamRequest (BFF Agent Stream Proxy)", () => {
  const originalGetSession = auth.api.getSession
  const originalSignJWT = auth.api.signJWT
  const originalFetch = globalThis.fetch
  const originalLoggerInfo = logger.info
  const originalLoggerError = logger.error

  beforeEach(() => {
    auth.api.getSession = originalGetSession
    auth.api.signJWT = originalSignJWT
    globalThis.fetch = originalFetch
  })

  afterEach(() => {
    auth.api.getSession = originalGetSession
    auth.api.signJWT = originalSignJWT
    globalThis.fetch = originalFetch
    logger.info = originalLoggerInfo
    logger.error = originalLoggerError
  })

  it("rejects non-POST methods with 405 Method Not Allowed", async () => {
    const request = new Request("http://localhost:3000/api/agent/stream", {
      method: "GET",
    })

    const response = await handleAgentStreamRequest(request)
    expect(response.status).toBe(405)
    expect(response.headers.get("Allow")).toBe("POST")
    const body = (await response.json()) as { error: string }
    expect(body.error).toBe("Method not allowed")
  })

  it("rejects unauthenticated requests with 401 Unauthorized", async () => {
    auth.api.getSession = mock(
      async () => null,
    ) as unknown as typeof auth.api.getSession

    const request = new Request("http://localhost:3000/api/agent/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "Hello" }),
    })

    const response = await handleAgentStreamRequest(request)
    expect(response.status).toBe(401)
    const body = (await response.json()) as { error: string }
    expect(body.error).toBe("Unauthorized")
  })

  it("rejects requests missing activeOrganizationId tenant context with 403", async () => {
    auth.api.getSession = mock(async () => ({
      user: { id: "user-123", email: "user@example.com" },
      session: { id: "sess-123", activeOrganizationId: null },
    })) as unknown as typeof auth.api.getSession

    const request = new Request("http://localhost:3000/api/agent/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "Hello" }),
    })

    const response = await handleAgentStreamRequest(request)
    expect(response.status).toBe(403)
    const body = (await response.json()) as { error: string }
    expect(body.error).toContain("Tenant context required")
  })

  it("rejects invalid or empty prompt payloads with 400", async () => {
    auth.api.getSession = mock(async () => ({
      user: { id: "user-123", email: "user@example.com" },
      session: { id: "sess-123", activeOrganizationId: "org-123" },
    })) as unknown as typeof auth.api.getSession

    // Empty prompt
    const request1 = new Request("http://localhost:3000/api/agent/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "   " }),
    })

    const response1 = await handleAgentStreamRequest(request1)
    expect(response1.status).toBe(400)

    // Malformed JSON
    const request2 = new Request("http://localhost:3000/api/agent/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{ bad json",
    })

    const response2 = await handleAgentStreamRequest(request2)
    expect(response2.status).toBe(400)
  })

  it("handles upstream Nabu 500 error by returning 502 Bad Gateway", async () => {
    auth.api.getSession = mock(async () => ({
      user: { id: "user-123", email: "user@example.com" },
      session: { id: "sess-123", activeOrganizationId: "org-123" },
    })) as unknown as typeof auth.api.getSession

    auth.api.signJWT = mock(async () => ({
      token: "mock-jwt-token",
    })) as unknown as typeof auth.api.signJWT

    globalThis.fetch = mock(
      async () =>
        new Response(JSON.stringify({ error: "Upstream engine crashed" }), {
          status: 500,
        }),
    ) as unknown as typeof fetch

    const request = new Request("http://localhost:3000/api/agent/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "What is my inventory?" }),
    })

    const response = await handleAgentStreamRequest(request)
    expect(response.status).toBe(502)
    const body = (await response.json()) as { error: string }
    expect(body.error).toBe("Agent runtime unavailable")
  })

  it("pipes SSE stream directly with zero-buffering headers on success", async () => {
    auth.api.getSession = mock(async () => ({
      user: { id: "user-123", email: "user@example.com" },
      session: { id: "sess-123", activeOrganizationId: "org-123" },
    })) as unknown as typeof auth.api.getSession

    auth.api.signJWT = mock(async () => ({
      token: "mock-jwt-token",
    })) as unknown as typeof auth.api.signJWT

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode("event: agent_event\ndata: {}\n\n"),
        )
        controller.close()
      },
    })

    globalThis.fetch = mock(
      async (url: string | URL | Request, init?: RequestInit) => {
        expect(url.toString()).toContain("/api/v1/agent/run")
        expect((init?.headers as Record<string, string>)?.Authorization).toBe(
          "Bearer mock-jwt-token",
        )
        expect((init?.headers as Record<string, string>)?.Accept).toBe(
          "text/event-stream",
        )
        return new Response(stream, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        })
      },
    ) as unknown as typeof fetch

    const infoCalls: Array<[Record<string, unknown>, string]> = []
    logger.info = mock(((event: Record<string, unknown>, msg: string) => {
      infoCalls.push([event, msg])
      return logger
    }) as unknown as typeof logger.info)

    const request = new Request("http://localhost:3000/api/agent/stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-request-id": "test-req-456",
      },
      body: JSON.stringify({ prompt: "Calculate summer margin" }),
    })

    const response = await handleAgentStreamRequest(request)
    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toBe("text/event-stream")
    expect(response.headers.get("Cache-Control")).toBe("no-cache, no-transform")
    expect(response.headers.get("Connection")).toBe("keep-alive")
    expect(response.headers.get("X-Accel-Buffering")).toBe("no")

    // Check wide event logging
    expect(infoCalls.length).toBe(1)
    const [event, msg] = infoCalls[0]
    expect(msg).toBe("[api.agent.stream] /api/agent/stream completed")
    expect(event.requestId).toBe("test-req-456")
    expect(event.tenantId).toBe("org-123")
    expect(event.outcome).toBe("success")
    expect(event.status_code).toBe(200)

    // Ensure token is NOT leaked in wide event log
    const eventStr = JSON.stringify(event)
    expect(eventStr).not.toContain("mock-jwt-token")
    expect(eventStr).not.toContain("Authorization")
  })
})
