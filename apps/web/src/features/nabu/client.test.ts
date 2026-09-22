import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { auth } from "@/lib/auth"
import { HttpClientError } from "@/lib/http"
import {
  dispatchAgentTask,
  getNabuSystemStatus,
  matchInflowReconciliation,
  NabuClientError,
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

  describe("matchInflowReconciliation", () => {
    it("validates input, injects token, and returns parsed match result", async () => {
      let capturedAuth: string | null = null
      globalThis.fetch = mock(async (_url, init) => {
        expect(init?.method).toBe("POST")
        const headers = new Headers(init?.headers)
        capturedAuth = headers.get("Authorization")
        const body = JSON.parse(init?.body as string)
        expect(body.reference).toBe("INV-2026-004")

        return Response.json({
          match_status: "confident",
          confidence_score: 0.96,
          matched_invoice_id: "inv_123",
          invoice_number: "INV-2026-004",
          variance: 0,
          reasons: ["Exact match"],
          suggested_action: "auto_reconcile",
        })
      }) as unknown as typeof fetch

      const result = await matchInflowReconciliation(
        {
          transaction_id: "tx_01",
          amount: 1500,
          reference: "INV-2026-004",
          sender_name: "Acme Corp",
        },
        { token: "reconciliation-jwt" },
      )

      expect(result.match_status).toBe("confident")
      expect(result.confidence_score).toBe(0.96)
      expect(result.invoice_number).toBe("INV-2026-004")
      expect(String(capturedAuth)).toBe("Bearer reconciliation-jwt")
    })

    it("rejects invalid input before making network request", async () => {
      let fetchCalled = false
      globalThis.fetch = mock(async () => {
        fetchCalled = true
        return Response.json({})
      }) as unknown as typeof fetch

      await expect(
        matchInflowReconciliation({
          transaction_id: "",
          amount: -10,
          reference: "",
          sender_name: "",
        }),
      ).rejects.toThrow()

      expect(fetchCalled).toBe(false)
    })
  })

  describe("dispatchAgentTask", () => {
    it("dispatches task payload, attaches bearer token, and returns result", async () => {
      let capturedAuth: string | null = null
      globalThis.fetch = mock(async (_url, init) => {
        expect(init?.method).toBe("POST")
        const headers = new Headers(init?.headers)
        capturedAuth = headers.get("Authorization")
        const body = JSON.parse(init?.body as string)
        expect(body.prompt).toBe("Scan overdue accounts")

        return Response.json({
          task_id: "task_01",
          status: "completed",
          summary: "Scan complete",
          items_analyzed: 5,
          hitl_required: false,
          execution_time_ms: 45,
        })
      }) as unknown as typeof fetch

      const result = await dispatchAgentTask(
        {
          prompt: "Scan overdue accounts",
          task_type: "receivables_audit",
          dry_run: true,
        },
        { token: "dispatch-jwt" },
      )

      expect(result.status).toBe("completed")
      expect(result.items_analyzed).toBe(5)
      expect(String(capturedAuth)).toBe("Bearer dispatch-jwt")
    })
  })
})
