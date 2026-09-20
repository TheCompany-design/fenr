import { afterEach, describe, expect, it, mock } from "bun:test"
import { HttpClientError } from "@/lib/http"
import {
  dispatchAgentTask,
  getNabuSystemStatus,
  matchInflowReconciliation,
} from "./client"

describe("Nabu HTTP Client", () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
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
      await expect(getNabuSystemStatus()).rejects.toThrow(HttpClientError)
    })

    it("throws HttpClientError when response is not ok", async () => {
      globalThis.fetch = mock(async () =>
        Response.json({ error: "internal server error" }, { status: 500 }),
      ) as unknown as typeof fetch

      expect(getNabuSystemStatus({ token: "test-token" })).rejects.toThrow(
        HttpClientError,
      )
    })

    it("throws HttpClientError on invalid response schema", async () => {
      globalThis.fetch = mock(async () =>
        Response.json({ invalid: "data" }),
      ) as unknown as typeof fetch

      expect(getNabuSystemStatus({ token: "test-token" })).rejects.toThrow(
        HttpClientError,
      )
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

      expect(
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
