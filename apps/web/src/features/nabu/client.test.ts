import { afterEach, describe, expect, it, mock } from "bun:test"

import {
  dispatchAgentTask,
  getNabuSystemStatus,
  matchInflowReconciliation,
  NabuClientError,
} from "./client"

describe("Nabu HTTP Client", () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  describe("getNabuSystemStatus", () => {
    it("returns parsed system status on success", async () => {
      globalThis.fetch = mock(async () =>
        Response.json({
          status: "online",
          version: "0.1.0",
          database: "connected",
          timestamp: "1726856400",
        }),
      ) as unknown as typeof fetch

      const result = await getNabuSystemStatus()
      expect(result.status).toBe("online")
      expect(result.version).toBe("0.1.0")
      expect(result.database).toBe("connected")
    })

    it("throws NabuClientError when response is not ok", async () => {
      globalThis.fetch = mock(async () =>
        Response.json({ error: "internal server error" }, { status: 500 }),
      ) as unknown as typeof fetch

      expect(getNabuSystemStatus()).rejects.toThrow(NabuClientError)
    })

    it("throws NabuClientError on invalid response schema", async () => {
      globalThis.fetch = mock(async () =>
        Response.json({ invalid: "data" }),
      ) as unknown as typeof fetch

      expect(getNabuSystemStatus()).rejects.toThrow(NabuClientError)
    })
  })

  describe("matchInflowReconciliation", () => {
    it("validates input and returns parsed match result", async () => {
      globalThis.fetch = mock(async (_url, init) => {
        expect(init?.method).toBe("POST")
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

      const result = await matchInflowReconciliation({
        transaction_id: "tx_01",
        amount: 1500,
        reference: "INV-2026-004",
        sender_name: "Acme Corp",
      })

      expect(result.match_status).toBe("confident")
      expect(result.confidence_score).toBe(0.96)
      expect(result.invoice_number).toBe("INV-2026-004")
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
    it("dispatches task payload and returns result", async () => {
      globalThis.fetch = mock(async (_url, init) => {
        expect(init?.method).toBe("POST")
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

      const result = await dispatchAgentTask({
        prompt: "Scan overdue accounts",
        task_type: "receivables_audit",
        dry_run: true,
      })

      expect(result.status).toBe("completed")
      expect(result.items_analyzed).toBe(5)
    })
  })
})
