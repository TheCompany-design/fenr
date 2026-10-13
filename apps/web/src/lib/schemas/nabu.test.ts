/**
 * The wire contract between this app and the agent runtime.
 *
 * Most of these schemas guard payloads this app requested from a runtime it
 * operates, so a refusal there is a normal validation failure. The model-listing
 * schemas are different: they are the first place vendor-originated data is
 * checked, and the response is validated as one — a single field on a single
 * model this schema refuses takes the entire catalogue with it and leaves the
 * picker holding an error that names neither the vendor nor the field.
 *
 * So the listing tests are about the edges: which absences are legal, which
 * numbers are legal, and what happens when one model in a good array is not.
 */
import { describe, expect, it } from "bun:test"
import {
  approvalDecisionInputSchema,
  listedModelSchema,
  nabuCapabilitiesSchema,
  nabuSystemStatusSchema,
  providerModelsResponseSchema,
  transcriptItemSchema,
  turnItemsResponseSchema,
} from "./nabu"

const TURN_ID = "0191eb5d-7a6c-7e6d-9290-349c2a61c3e2"
const ITEM_ID = "0191eb5d-7a6c-7e6d-9290-349c2a61c3e3"
const TENANT_ID = "0191eb5d-7a6c-7e6d-9290-349c2a61c3e4"

/** A response body the runtime would send for a healthy catalogue. */
function catalogue(
  models: unknown[] = [{ id: "gpt-4o" }],
): Record<string, unknown> {
  return { ok: true, models }
}

describe("listedModelSchema", () => {
  it("accepts an id and nothing else, which is all OpenAI publishes", () => {
    expect(listedModelSchema.parse({ id: "gpt-4o" })).toEqual({ id: "gpt-4o" })
  })

  it("requires an id", () => {
    expect(listedModelSchema.safeParse({}).success).toBe(false)
    expect(listedModelSchema.safeParse({ id: "" }).success).toBe(false)
  })

  it("accepts every optional field the runtime may send", () => {
    const model = {
      id: "anthropic/claude-sonnet-5",
      display_name: "Anthropic: Claude Sonnet 5",
      context_window: 1_000_000,
      max_output_tokens: 128_000,
      accepts_images: true,
      pricing: { input_usd: 3, output_usd: 15 },
    }
    expect(listedModelSchema.parse(model)).toEqual(model)
  })

  it("accepts a zero limit rather than failing the whole catalogue over it", () => {
    // The runtime treats a published zero as an unknown limit and sends nothing,
    // so this cannot arrive from it today. It is accepted anyway: a schema that
    // guards its own output must not be the thing that discards a whole
    // catalogue over one odd number on one of seven hundred models.
    expect(
      listedModelSchema.safeParse({ id: "m", context_window: 0 }).success,
    ).toBe(true)
  })

  it("rejects a limit that is not a whole number", () => {
    expect(
      listedModelSchema.safeParse({ id: "m", context_window: 1.5 }).success,
    ).toBe(false)
  })

  it("rejects a number no token count could be", () => {
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, -1]) {
      expect(
        listedModelSchema.safeParse({ id: "m", context_window: value }).success,
      ).toBe(false)
    }
  })

  it("rejects a half-stated price", () => {
    expect(
      listedModelSchema.safeParse({ id: "m", pricing: { input_usd: 3 } })
        .success,
    ).toBe(false)
  })

  it("accepts a price of zero, which is a stated price", () => {
    expect(
      listedModelSchema.parse({
        id: "m",
        pricing: { input_usd: 0, output_usd: 0 },
      }).pricing,
    ).toEqual({ input_usd: 0, output_usd: 0 })
  })
})

describe("providerModelsResponseSchema", () => {
  it("accepts a healthy catalogue", () => {
    expect(providerModelsResponseSchema.safeParse(catalogue()).success).toBe(
      true,
    )
  })

  it("accepts an empty catalogue, which is an answer and not a failure", () => {
    expect(providerModelsResponseSchema.safeParse(catalogue([])).success).toBe(
      true,
    )
  })

  it("accepts a declined credential carrying only its sentence", () => {
    expect(
      providerModelsResponseSchema.safeParse({
        ok: false,
        message: "the provider did not accept the stored credential",
      }).success,
    ).toBe(true)
  })

  it("documents the blast radius of one bad model", () => {
    // The whole body is parsed as one, so a single entry this schema refuses
    // takes the entire catalogue with it — and the caller gets a validation
    // error naming neither the vendor nor the field. This is why the schema is
    // as permissive as it can honestly be: it guards its own output, and it
    // refuses only what it cannot represent.
    const good = { id: "gpt-4o", context_window: 128_000 }
    const withoutAnId = { display_name: "a model that never sent one" }

    expect(
      providerModelsResponseSchema.safeParse(catalogue([good])).success,
    ).toBe(true)
    expect(
      providerModelsResponseSchema.safeParse(catalogue([good, withoutAnId]))
        .success,
      // One unidentifiable model costs the whole list — which is exactly why
      // the runtime never sends one, and why this schema stays this permissive.
    ).toBe(false)
  })
})

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
