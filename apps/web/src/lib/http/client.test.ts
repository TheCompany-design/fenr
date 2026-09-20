import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { z } from "zod"
import { executeRequest } from "./client"
import { HttpClientError } from "./errors"
import { defineAuthenticatedEndpoint, definePublicEndpoint } from "./types"

const mockResponseSchema = z.object({
  id: z.string(),
  success: z.boolean(),
})

const mockInputSchema = z.object({
  query: z.string().min(1),
  count: z.number().int().positive(),
})

const testAuthenticatedEndpoint = defineAuthenticatedEndpoint<
  { query: string; count: number },
  { id: string; success: boolean }
>({
  id: "test.authenticated",
  service: "nabu",
  audience: "nabu",
  method: "POST",
  path: "/api/v1/test",
  inputSchema: mockInputSchema,
  responseSchema: mockResponseSchema,
  timeoutMs: 5000,
})

const testPublicEndpoint = definePublicEndpoint<
  void,
  { id: string; success: boolean }
>({
  id: "test.public",
  service: "demo",
  method: "GET",
  path: "https://example.com/api/v1/public-test",
  responseSchema: mockResponseSchema,
  timeoutMs: 5000,
})

describe("Outbound HTTP Transport (executeRequest)", () => {
  const originalFetch = globalThis.fetch
  let capturedRequest: { url: string; init?: RequestInit } | null = null

  function setMockFetch(
    fn: (url: string | URL | Request, init?: RequestInit) => Promise<Response>,
  ) {
    globalThis.fetch = mock(fn) as unknown as typeof fetch
  }

  beforeEach(() => {
    capturedRequest = null
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it("injects Authorization: Bearer <jwt> for authenticated endpoints", async () => {
    setMockFetch(async (url: string | URL | Request, init?: RequestInit) => {
      capturedRequest = { url: String(url), init }
      return new Response(JSON.stringify({ id: "res_1", success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    })

    const result = await executeRequest(testAuthenticatedEndpoint, {
      input: { query: "fenr", count: 3 },
      token: "mock-jwt-token-xyz",
    })

    expect(result.id).toBe("res_1")
    expect(result.success).toBe(true)

    const headers = new Headers(capturedRequest?.init?.headers)
    expect(headers.get("Authorization")).toBe("Bearer mock-jwt-token-xyz")
    expect(headers.get("Accept")).toBe("application/json")
    expect(headers.get("Content-Type")).toBe("application/json")
    expect(headers.get("X-Request-Id")).toBeDefined()
  })

  it("prevents caller-supplied Authorization header from overriding the authentic token", async () => {
    setMockFetch(async (url: string | URL | Request, init?: RequestInit) => {
      capturedRequest = { url: String(url), init }
      return new Response(JSON.stringify({ id: "res_1", success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    })

    await executeRequest(testAuthenticatedEndpoint, {
      input: { query: "audit", count: 1 },
      token: "valid-server-jwt",
      headers: {
        // @ts-expect-error Authorization is explicitly forbidden by SafeCallerHeaders
        Authorization: "Bearer malicious-caller-override",
      },
    })

    const headers = new Headers(capturedRequest?.init?.headers)
    expect(headers.get("Authorization")).toBe("Bearer valid-server-jwt")
  })

  it("ensures public endpoints NEVER send an Authorization header", async () => {
    setMockFetch(async (url: string | URL | Request, init?: RequestInit) => {
      capturedRequest = { url: String(url), init }
      return new Response(JSON.stringify({ id: "public_1", success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    })

    await executeRequest(testPublicEndpoint, {
      headers: {
        // @ts-expect-error Authorization is explicitly forbidden by SafeCallerHeaders
        Authorization: "Bearer should-be-stripped",
      },
    })

    const headers = new Headers(capturedRequest?.init?.headers)
    expect(headers.has("Authorization")).toBe(false)
  })

  it("validates request input and rejects invalid payloads before dispatching fetch", async () => {
    let fetchCalled = false
    setMockFetch(async () => {
      fetchCalled = true
      return new Response(JSON.stringify({ id: "1", success: true }))
    })

    await expect(
      executeRequest(testAuthenticatedEndpoint, {
        input: { query: "", count: -5 },
        token: "test-token",
      }),
    ).rejects.toThrow(HttpClientError)

    expect(fetchCalled).toBe(false)
  })

  it("propagates caller-supplied X-Request-Id and custom headers cleanly", async () => {
    setMockFetch(async (url: string | URL | Request, init?: RequestInit) => {
      capturedRequest = { url: String(url), init }
      return new Response(JSON.stringify({ id: "1", success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    })

    await executeRequest(testPublicEndpoint, {
      requestId: "custom-trace-id-1234",
      headers: {
        "X-Custom-Client": "fenr-web",
      },
    })

    const headers = new Headers(capturedRequest?.init?.headers)
    expect(headers.get("X-Request-Id")).toBe("custom-trace-id-1234")
    expect(headers.get("X-Custom-Client")).toBe("fenr-web")
  })

  it("delegates to custom tokenProvider when provided", async () => {
    setMockFetch(async (url: string | URL | Request, init?: RequestInit) => {
      capturedRequest = { url: String(url), init }
      return new Response(JSON.stringify({ id: "1", success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    })

    const mockProvider = mock(async (auth: { audience: string }) => {
      expect(auth.audience).toBe("nabu")
      return "dynamic-provided-token"
    })

    await executeRequest(testAuthenticatedEndpoint, {
      input: { query: "delegated", count: 2 },
      tokenProvider: mockProvider,
    })

    expect(mockProvider).toHaveBeenCalled()
    const headers = new Headers(capturedRequest?.init?.headers)
    expect(headers.get("Authorization")).toBe("Bearer dynamic-provided-token")
  })

  it("handles non-2xx HTTP responses and constructs structured HttpClientError", async () => {
    setMockFetch(async () => {
      return new Response(
        JSON.stringify({ error: "Invoice not found", code: "NOT_FOUND" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        },
      )
    })

    try {
      await executeRequest(testPublicEndpoint)
      expect(true).toBe(false) // Should not reach here
    } catch (err) {
      expect(err).toBeInstanceOf(HttpClientError)
      const httpErr = err as HttpClientError
      expect(httpErr.status).toBe(404)
      expect(httpErr.code).toBe("HTTP_ERROR")
      expect(httpErr.details).toEqual({
        error: "Invoice not found",
        code: "NOT_FOUND",
      })
      expect(httpErr.getUserMessage()).toBe(
        "The requested resource was not found.",
      )
    }
  })

  it("handles malformed JSON responses defensively", async () => {
    setMockFetch(async () => {
      return new Response(
        "<html><head><title>Bad Gateway</title></head><body>502</body></html>",
        {
          status: 200,
          headers: { "Content-Type": "text/html" },
        },
      )
    })

    try {
      await executeRequest(testPublicEndpoint)
      expect(true).toBe(false)
    } catch (err) {
      expect(err).toBeInstanceOf(HttpClientError)
      const httpErr = err as HttpClientError
      expect(httpErr.status).toBe(502)
      expect(httpErr.code).toBe("MALFORMED_RESPONSE")
      expect(httpErr.getUserMessage()).toContain("unexpected response")
    }
  })

  it("handles response schema validation failures defensively", async () => {
    setMockFetch(async () => {
      return new Response(
        JSON.stringify({ unexpectedField: 123 }), // Missing 'id' and 'success'
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      )
    })

    try {
      await executeRequest(testPublicEndpoint)
      expect(true).toBe(false)
    } catch (err) {
      expect(err).toBeInstanceOf(HttpClientError)
      const httpErr = err as HttpClientError
      expect(httpErr.status).toBe(502)
      expect(httpErr.code).toBe("VALIDATION_ERROR")
      expect(Array.isArray(httpErr.details)).toBe(true)
    }
  })

  it("handles abort signal cancellation cleanly", async () => {
    const controller = new AbortController()
    setMockFetch(async (_url: string | URL | Request, init?: RequestInit) => {
      const signal = init?.signal
      return new Promise((_resolve, reject) => {
        signal?.addEventListener("abort", () => {
          reject(new DOMException("The user aborted a request.", "AbortError"))
        })
      })
    })

    const requestPromise = executeRequest(testPublicEndpoint, {
      signal: controller.signal,
    })

    // Trigger cancellation
    controller.abort()

    try {
      await requestPromise
      expect(true).toBe(false)
    } catch (err) {
      expect(err).toBeInstanceOf(HttpClientError)
      const httpErr = err as HttpClientError
      expect(httpErr.code).toBe("CANCELLED")
      expect(httpErr.status).toBe(499)
      expect(httpErr.getUserMessage()).toBe("Request was cancelled.")
    }
  })

  it("handles request timeout cleanly when server does not respond in time", async () => {
    setMockFetch(async (_url: string | URL | Request, init?: RequestInit) => {
      const signal = init?.signal
      return new Promise((_resolve, reject) => {
        signal?.addEventListener("abort", () => {
          reject(
            signal.reason ??
              new DOMException("Request timed out", "TimeoutError"),
          )
        })
      })
    })

    const shortTimeoutEndpoint = definePublicEndpoint<
      void,
      { id: string; success: boolean }
    >({
      id: "test.timeout",
      service: "demo",
      method: "GET",
      path: "https://example.com/api/v1/timeout-test",
      responseSchema: mockResponseSchema,
      timeoutMs: 40,
    })

    try {
      await executeRequest(shortTimeoutEndpoint)
      expect(true).toBe(false)
    } catch (err) {
      expect(err).toBeInstanceOf(HttpClientError)
      const httpErr = err as HttpClientError
      expect(httpErr.code).toBe("TIMEOUT")
      expect(httpErr.status).toBe(504)
      expect(httpErr.getUserMessage()).toContain("took too long to respond")
    }
  })

  it("rejects authenticated requests targeting an unauthorized origin", async () => {
    const maliciousEndpoint = defineAuthenticatedEndpoint<void, unknown>({
      id: "test.malicious",
      service: "nabu",
      audience: "nabu",
      method: "GET",
      path: "https://attacker.evil.com/exfiltrate",
      responseSchema: z.unknown(),
    })

    try {
      await executeRequest(maliciousEndpoint, { token: "secret-token" })
      expect(true).toBe(false)
    } catch (err) {
      expect(err).toBeInstanceOf(HttpClientError)
      const httpErr = err as HttpClientError
      expect(httpErr.code).toBe("CLIENT_CONFIGURATION_ERROR")
      expect(httpErr.message).toContain("Security violation")
    }
  })

  it("rejects missing input when inputSchema is defined", async () => {
    try {
      await executeRequest(testAuthenticatedEndpoint, {
        input: undefined as unknown as { query: string; count: number },
        token: "mock-token",
      })
      expect(true).toBe(false)
    } catch (err) {
      expect(err).toBeInstanceOf(HttpClientError)
      const httpErr = err as HttpClientError
      expect(httpErr.code).toBe("VALIDATION_ERROR")
      expect(httpErr.status).toBe(400)
    }
  })

  it("preserves plain-text error response in details when JSON parsing fails", async () => {
    setMockFetch(async () => {
      return new Response("Service Unavailable: Upstream cluster unreachable", {
        status: 503,
        headers: { "Content-Type": "text/plain" },
      })
    })

    try {
      await executeRequest(testPublicEndpoint)
      expect(true).toBe(false)
    } catch (err) {
      expect(err).toBeInstanceOf(HttpClientError)
      const httpErr = err as HttpClientError
      expect(httpErr.status).toBe(503)
      expect(httpErr.details).toBe(
        "Service Unavailable: Upstream cluster unreachable",
      )
    }
  })

  it("handles empty 200 response body without content-length as undefined", async () => {
    const emptyEndpoint = definePublicEndpoint<void, void>({
      id: "test.empty-200",
      service: "demo",
      method: "GET",
      path: "https://example.com/api/v1/empty-200",
      responseSchema: z.void(),
    })

    setMockFetch(async () => {
      return new Response("", { status: 200 })
    })

    const res = await executeRequest(emptyEndpoint)
    expect(res).toBeUndefined()
  })

  it("ensures defineAuthenticatedEndpoint does not leak audience as a top-level property", () => {
    expect("audience" in testAuthenticatedEndpoint).toBe(false)
    expect(testAuthenticatedEndpoint.auth.audience).toBe("nabu")
  })

  it("strips caller-supplied authorization headers case-insensitively", async () => {
    setMockFetch(async (_url: string | URL | Request, init?: RequestInit) => {
      capturedRequest = { url: String(_url), init }
      return new Response(JSON.stringify({ id: "res_case", success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    })

    await executeRequest(testPublicEndpoint, {
      headers: {
        AUTHORIZATION: "Bearer spoofed-token-1",
        AuThOrIzAtIoN: "Bearer spoofed-token-2",
      } as unknown as Record<string, string>,
    })

    const headers = new Headers(capturedRequest?.init?.headers)
    expect(headers.get("authorization")).toBeNull()
    expect(headers.get("Authorization")).toBeNull()
  })

  it("handles HTTP 204 No Content without throwing MALFORMED_RESPONSE", async () => {
    const noContentEndpoint = definePublicEndpoint<void, void>({
      id: "test.no-content",
      service: "demo",
      method: "DELETE",
      path: "https://example.com/api/v1/delete-test",
      responseSchema: z.void(),
    })

    setMockFetch(async () => {
      return new Response(null, { status: 204 })
    })

    const result = await executeRequest(noContentEndpoint)
    expect(result).toBeUndefined()
  })

  it("produces non-leaky error messages for unreachable services", async () => {
    setMockFetch(async () => {
      throw new Error("connect ECONNREFUSED 127.0.0.1:5050")
    })

    try {
      await executeRequest(testAuthenticatedEndpoint, {
        input: { query: "fenr", count: 1 },
        token: "mock-token",
      })
      expect(true).toBe(false)
    } catch (err) {
      expect(err).toBeInstanceOf(HttpClientError)
      const httpErr = err as HttpClientError
      expect(httpErr.code).toBe("SERVICE_UNREACHABLE")
      expect(httpErr.status).toBe(503)
      // Error message MUST NOT leak raw host/port/socket strings
      expect(httpErr.message).toBe("Unable to reach nabu service")
      expect(httpErr.message).not.toContain("127.0.0.1")
      expect(httpErr.message).not.toContain("ECONNREFUSED")
      expect(httpErr.getUserMessage()).toContain("Unable to reach nabu service")
    }
  })

  it("rejects immediately if signal is already aborted prior to dispatch", async () => {
    const controller = new AbortController()
    controller.abort(new Error("Pre-aborted"))

    await expect(
      executeRequest(testPublicEndpoint, {
        signal: controller.signal,
      }),
    ).rejects.toThrow(HttpClientError)
  })
})
