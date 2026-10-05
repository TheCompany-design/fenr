/**
 * The schemas for what the agent runtime actually serves.
 *
 * The reconciliation and agent-task schemas these replace described endpoints
 * the runtime does not have: `POST /api/v1/reconciliation/match` and
 * `POST /api/v1/agent/tasks` both answered 404. They validated happily, which is
 * why the failure only ever showed up as a button that did nothing.
 */

import { describe, expect, it } from "bun:test"
import {
  approvalDecisionInputSchema,
  nabuCapabilitiesSchema,
  nabuSystemStatusSchema,
  transcriptItemSchema,
  turnItemsResponseSchema,
} from "./nabu"

const TURN_ID = "0191eb5d-7a6c-7e6d-9290-349c2a61c3e2"
const ITEM_ID = "0191eb5d-7a6c-7e6d-9290-349c2a61c3e3"
const TENANT_ID = "0191eb5d-7a6c-7e6d-9290-349c2a61c3e4"

describe("Nabu Schemas Validation", () => {
  describe("nabuSystemStatusSchema", () => {
    it("accepts valid system status payload", () => {
      expect(
        nabuSystemStatusSchema.parse({
          status: "online",
          version: "0.1.0",
          database: "connected",
          timestamp: "1767225600",
        }),
      ).toMatchObject({ status: "online", database: "connected" })
    })

    it("rejects invalid system status payload", () => {
      expect(() => nabuSystemStatusSchema.parse({ status: "online" })).toThrow()
    })
  })

  describe("nabuCapabilitiesSchema", () => {
    it("accepts the payload the runtime sends", () => {
      const capabilities = nabuCapabilitiesSchema.parse({
        tools: ["echo"],
        max_model_steps: 8,
        max_attempts: 3,
        detach_on_disconnect: true,
      })
      expect(capabilities.tools).toEqual(["echo"])
      expect(capabilities.max_attempts).toBe(3)
    })

    it("rejects a deployment with no attempts", () => {
      // An attempt budget of zero would mean no turn could ever run.
      expect(() =>
        nabuCapabilitiesSchema.parse({
          tools: [],
          max_model_steps: 1,
          max_attempts: 0,
          detach_on_disconnect: true,
        }),
      ).toThrow()
    })
  })

  describe("approvalDecisionInputSchema", () => {
    it("accepts an approval and a denial", () => {
      for (const decision of ["approved", "denied"] as const) {
        expect(
          approvalDecisionInputSchema.parse({ item_id: ITEM_ID, decision }),
        ).toEqual({ item_id: ITEM_ID, decision })
      }
    })

    it("rejects an unrecognised decision", () => {
      // The runtime only records two, and a third would be silently dropped by
      // its database constraint.
      expect(() =>
        approvalDecisionInputSchema.parse({
          item_id: ITEM_ID,
          decision: "maybe",
        }),
      ).toThrow()
    })

    it("rejects a decision that does not name an item", () => {
      expect(() =>
        approvalDecisionInputSchema.parse({ decision: "approved" }),
      ).toThrow()
    })
  })

  describe("transcriptItemSchema", () => {
    const base = {
      id: ITEM_ID,
      thread_id: "0191eb5d-7a6c-7e6d-9290-349c2a61c3e1",
      turn_id: TURN_ID,
      tenant_id: TENANT_ID,
      created_at: "2026-01-01T00:00:00Z",
    }

    it("accepts every item kind the runtime records", () => {
      const payloads = [
        { kind: "user_message", content: "hello" },
        { kind: "agent_message", text: "hi", thinking: "considering" },
        {
          kind: "tool_call",
          call_id: "call_1",
          name: "echo",
          arguments: { text: "hi" },
        },
        {
          kind: "tool_result",
          call_id: "call_1",
          name: "echo",
          output: "ok",
          truncated: false,
          outcome: "unknown",
        },
        {
          kind: "approval_request",
          call_id: "call_1",
          tool: "echo",
          arguments: { text: "hi" },
        },
        {
          kind: "approval_decision",
          call_id: "call_1",
          decision: "approved",
          decided_by: TENANT_ID,
        },
      ] as const

      for (const payload of payloads) {
        const parsed = transcriptItemSchema.parse({
          ...base,
          kind: payload.kind,
          payload,
        })
        expect(parsed.payload.kind).toBe(payload.kind)
      }
    })

    it("keeps an unknown tool outcome rather than defaulting it", () => {
      // An unobserved effect is the case that matters most, and silently
      // turning it into a success is the failure this guards against.
      const parsed = transcriptItemSchema.parse({
        ...base,
        kind: "tool_result",
        payload: {
          kind: "tool_result",
          call_id: "call_1",
          name: "echo",
          output: "?",
          truncated: false,
          outcome: "unknown",
        },
      })
      if (parsed.payload.kind === "tool_result") {
        expect(parsed.payload.outcome).toBe("unknown")
      }
    })

    it("preserves tool arguments of any JSON shape", () => {
      const parsed = transcriptItemSchema.parse({
        ...base,
        kind: "tool_call",
        payload: {
          kind: "tool_call",
          call_id: "call_1",
          name: "echo",
          arguments: [1, { nested: true }, null],
        },
      })
      if (parsed.payload.kind === "tool_call") {
        expect(parsed.payload.arguments).toEqual([1, { nested: true }, null])
      }
    })
  })

  describe("turnItemsResponseSchema", () => {
    it("accepts a page and reports whether more exist", () => {
      const page = turnItemsResponseSchema.parse({
        turn_id: TURN_ID,
        has_more: true,
        items: [],
      })
      expect(page.has_more).toBe(true)
      expect(page.turn_id).toBe(TURN_ID)
    })

    it("rejects a page whose turn does not match a uuid", () => {
      expect(() =>
        turnItemsResponseSchema.parse({
          turn_id: "nope",
          has_more: false,
          items: [],
        }),
      ).toThrow()
    })
  })
})
