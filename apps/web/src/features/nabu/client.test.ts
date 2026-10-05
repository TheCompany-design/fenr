import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { auth } from "@/lib/auth"
import { HttpClientError } from "@/lib/http"
import {
  cancelTurn,
  decideApproval,
  getNabuCapabilities,
  getNabuSystemStatus,
  getTurnItems,
  NabuClientError,
  resumeTurn,
} from "./nabu.server"

describe("Nabu HTTP Client", () => {
  const originalFetch = globalThis.fetch
  const originalGetSession = auth.api.getSession
  const originalVerifyJWT = auth.api.verifyJWT

  beforeEach(() => {
    auth.api.getSession = mock(async () => ({
      user: {
        id: "user_nabu_test",
        email: "test@nabu.dev",
        name: "Nabu Test",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      session: {
        id: "sess_nabu_test",
        userId: "user_nabu_test",
        expiresAt: new Date(Date.now() + 3600_000),
        createdAt: new Date(),
        updatedAt: new Date(),
        token: "tok_nabu_test",
        activeOrganizationId: "org_nabu_test",
        ipAddress: null,
        userAgent: null,
      },
    })) as unknown as typeof auth.api.getSession

    auth.api.verifyJWT = mock(async ({ body }: { body: { token: string } }) => {
      if (body.token === "unauthorized-token") {
        return { payload: null }
      }
      return {
        payload: {
          sub: "user_nabu_test",
          email: "test@nabu.dev",
          activeOrganizationId: "org_nabu_test",
          aud: "nabu",
        },
      }
    }) as unknown as typeof auth.api.verifyJWT
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    auth.api.getSession = originalGetSession
    auth.api.verifyJWT = originalVerifyJWT
  })

  describe("getNabuSystemStatus", () => {
    it("returns parsed system status on success and attaches bearer token", async () => {
      let capturedAuth: string | null = null
      globalThis.fetch = mock(async (_url, init) => {
        const headers = new Headers(init?.headers)
        capturedAuth = headers.get("Authorization")
        return Response.json({
          status: "online",
          version: "0.1.0",
          database: "connected",
          timestamp: "1726856400",
        })
      }) as unknown as typeof fetch

      const result = await getNabuSystemStatus({ token: "test-nabu-token" })
      expect(result.status).toBe("online")
      expect(result.version).toBe("0.1.0")
      expect(result.database).toBe("connected")
      expect(String(capturedAuth)).toBe("Bearer test-nabu-token")
    })

    it("throws HttpClientError with UNAUTHENTICATED when called without a session or token", async () => {
      auth.api.getSession = mock(
        async () => null,
      ) as unknown as typeof auth.api.getSession
      try {
        await getNabuSystemStatus()
        expect(true).toBe(false)
      } catch (err) {
        expect(err).toBeInstanceOf(NabuClientError)
        const nabuErr = err as NabuClientError
        expect(nabuErr.code).toBe("UNAUTHENTICATED")
        expect(nabuErr.status).toBe(401)
      }
    })

    it("throws HttpClientError when response is not ok", async () => {
      globalThis.fetch = mock(async () =>
        Response.json({ error: "internal server error" }, { status: 500 }),
      ) as unknown as typeof fetch

      await expect(
        getNabuSystemStatus({ token: "test-token" }),
      ).rejects.toThrow(HttpClientError)
    })

    it("throws HttpClientError on invalid response schema", async () => {
      globalThis.fetch = mock(async () =>
        Response.json({ invalid: "data" }),
      ) as unknown as typeof fetch

      await expect(
        getNabuSystemStatus({ token: "test-token" }),
      ).rejects.toThrow(HttpClientError)
    })
  })

  describe("decideApproval", () => {
    it("routes to the turn's approvals endpoint and sends the decision", async () => {
      let capturedUrl = ""
      let capturedAuth: string | null = null
      let capturedBody: unknown = null

      globalThis.fetch = mock(async (url, init) => {
        capturedUrl = String(url)
        const headers = new Headers(init?.headers)
        capturedAuth = headers.get("Authorization")
        capturedBody = JSON.parse(init?.body as string)
        // The runtime answers with 202 and no body.
        return new Response(null, { status: 202 })
      }) as unknown as typeof fetch

      await decideApproval(
        {
          turnId: "0191eb5d-7a6c-7e6d-9290-349c2a61c3e2",
          itemId: "0191eb5d-7a6c-7e6d-9290-349c2a61c3e3",
          decision: "approved",
        },
        { token: "approval-jwt" },
      )

      // Pinned literally: this path is what was wrong once, when the client
      // still pointed at an endpoint the runtime had replaced.
      expect(capturedUrl).toContain(
        "/api/v1/threads/0191eb5d-7a6c-7e6d-9290-349c2a61c3e2/approvals",
      )
      expect(String(capturedAuth)).toBe("Bearer approval-jwt")
      // Exactly what the runtime declares, and nothing else: turn_id is a path
      // segment, not a field it reads from the body.
      expect(capturedBody).toEqual({
        item_id: "0191eb5d-7a6c-7e6d-9290-349c2a61c3e3",
        decision: "approved",
      })
    })

    it("routes cancellation and resumption to their own turn endpoints", async () => {
      const urls: string[] = []
      const bodies: (string | undefined)[] = []
      globalThis.fetch = mock(async (url, init) => {
        urls.push(String(url))
        bodies.push((init?.body as string | undefined) ?? undefined)
        return new Response(null, { status: 202 })
      }) as unknown as typeof fetch

      const turnId = "0191eb5d-7a6c-7e6d-9290-349c2a61c3e2"
      await cancelTurn({ turnId }, { token: "jwt" })
      await resumeTurn({ turnId }, { token: "jwt" })

      expect(urls[0]).toContain(`/api/v1/threads/${turnId}/cancel`)
      expect(urls[1]).toContain(`/api/v1/threads/${turnId}/resume`)
      // Neither endpoint takes a payload, so neither is sent one.
      expect(bodies).toEqual([undefined, undefined])
    })
  })

  describe("getTurnItems", () => {
    it("reads a turn's items and keeps tool payloads intact", async () => {
      let capturedUrl = ""
      globalThis.fetch = mock(async (url) => {
        capturedUrl = String(url)
        return Response.json({
          turn_id: "0191eb5d-7a6c-7e6d-9290-349c2a61c3e2",
          has_more: false,
          items: [
            {
              id: "0191eb5d-7a6c-7e6d-9290-349c2a61c3e3",
              thread_id: "0191eb5d-7a6c-7e6d-9290-349c2a61c3e1",
              turn_id: "0191eb5d-7a6c-7e6d-9290-349c2a61c3e2",
              tenant_id: "0191eb5d-7a6c-7e6d-9290-349c2a61c3e4",
              kind: "tool_result",
              payload: {
                kind: "tool_result",
                call_id: "call_1",
                name: "echo",
                output: "ok",
                truncated: false,
                outcome: "succeeded",
              },
              created_at: "2026-01-01T00:00:00Z",
            },
          ],
        })
      }) as unknown as typeof fetch

      const result = await getTurnItems(
        { turnId: "0191eb5d-7a6c-7e6d-9290-349c2a61c3e2" },
        { token: "jwt" },
      )

      expect(capturedUrl).toContain(
        "/api/v1/threads/0191eb5d-7a6c-7e6d-9290-349c2a61c3e2/items",
      )
      // The item kinds the transcript gained are the point: a tool result is
      // data now, not an event that fails to parse.
      expect(result.items).toHaveLength(1)
      expect(result.items[0]?.kind).toBe("tool_result")
    })
  })

  describe("getNabuCapabilities", () => {
    it("reads the deployment's real limits", async () => {
      let capturedUrl = ""
      globalThis.fetch = mock(async (url) => {
        capturedUrl = String(url)
        return Response.json({
          tools: ["echo"],
          max_model_steps: 8,
          max_attempts: 3,
          detach_on_disconnect: true,
        })
      }) as unknown as typeof fetch

      const capabilities = await getNabuCapabilities({ token: "jwt" })
      expect(capturedUrl).toContain("/api/v1/capabilities")
      expect(capabilities.tools).toEqual(["echo"])
      expect(capabilities.detach_on_disconnect).toBe(true)
    })
  })
})
