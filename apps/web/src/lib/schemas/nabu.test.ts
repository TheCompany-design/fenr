import { describe, expect, it } from "bun:test"

import {
  createAgentTaskInputSchema,
  nabuSystemStatusSchema,
  reconciliationMatchInputSchema,
  reconciliationMatchResultSchema,
} from "./nabu"

describe("Nabu Schemas Validation", () => {
  describe("nabuSystemStatusSchema", () => {
    it("accepts valid system status payload", () => {
      const valid = {
        status: "online",
        version: "0.1.0",
        database: "connected",
        timestamp: "1726856400",
      }
      const result = nabuSystemStatusSchema.safeParse(valid)
      expect(result.success).toBe(true)
    })

    it("rejects invalid system status payload", () => {
      const invalid = {
        status: "online",
        // missing version, database, timestamp
      }
      const result = nabuSystemStatusSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })
  })

  describe("reconciliationMatchInputSchema", () => {
    it("accepts valid reconciliation input with defaults", () => {
      const input = {
        transaction_id: "tx_123",
        amount: 1500,
        reference: "INV-2026-001",
        sender_name: "Acme Corp",
      }
      const result = reconciliationMatchInputSchema.safeParse(input)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.currency).toBe("KES")
      }
    })

    it("rejects non-positive amount", () => {
      const input = {
        transaction_id: "tx_123",
        amount: -50,
        reference: "INV-2026-001",
        sender_name: "Acme Corp",
      }
      const result = reconciliationMatchInputSchema.safeParse(input)
      expect(result.success).toBe(false)
    })

    it("rejects missing transaction_id or reference", () => {
      const input = {
        transaction_id: "",
        amount: 100,
        reference: "",
        sender_name: "Acme",
      }
      const result = reconciliationMatchInputSchema.safeParse(input)
      expect(result.success).toBe(false)
    })
  })

  describe("reconciliationMatchResultSchema", () => {
    it("accepts valid reconciliation result", () => {
      const resultPayload = {
        match_status: "confident",
        confidence_score: 0.96,
        matched_invoice_id: "inv_123",
        invoice_number: "INV-2026-001",
        variance: 0,
        reasons: ["Exact reference match"],
        suggested_action: "auto_reconcile",
      }
      const result = reconciliationMatchResultSchema.safeParse(resultPayload)
      expect(result.success).toBe(true)
    })

    it("rejects confidence score out of bounds", () => {
      const resultPayload = {
        match_status: "confident",
        confidence_score: 1.5,
        matched_invoice_id: "inv_123",
        invoice_number: "INV-2026-001",
        variance: 0,
        reasons: [],
        suggested_action: "auto_reconcile",
      }
      const result = reconciliationMatchResultSchema.safeParse(resultPayload)
      expect(result.success).toBe(false)
    })
  })

  describe("createAgentTaskInputSchema", () => {
    it("applies defaults for task_type and dry_run", () => {
      const input = {
        prompt: "Check overdue invoices",
      }
      const result = createAgentTaskInputSchema.safeParse(input)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.task_type).toBe("receivables_audit")
        expect(result.data.dry_run).toBe(true)
      }
    })

    it("rejects empty prompt", () => {
      const input = {
        prompt: "",
      }
      const result = createAgentTaskInputSchema.safeParse(input)
      expect(result.success).toBe(false)
    })
  })
})
