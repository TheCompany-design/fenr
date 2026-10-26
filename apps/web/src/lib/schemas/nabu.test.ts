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

  it("accepts the storefront lifecycle, both verdicts and an absence", () => {
    expect(
      listedModelSchema.parse({
        id: "nvidia/gpt-oss-20b",
        storefront: { published: true },
      }),
    ).toEqual({ id: "nvidia/gpt-oss-20b", storefront: { published: true } })
    expect(
      listedModelSchema.parse({
        id: "nvidia/gpt-oss-120b",
        storefront: {
          published: false,
          serving: false,
          ends_on: "2026-10-27",
        },
      }),
    ).toEqual({
      id: "nvidia/gpt-oss-120b",
      storefront: { published: false, serving: false, ends_on: "2026-10-27" },
    })
    expect(listedModelSchema.parse({ id: "nvidia/gpt-oss-20b" })).toEqual({
      id: "nvidia/gpt-oss-20b",
    })
  })

  it("accepts a zero limit rather than failing the whole catalogue over it", () => {
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

  const scale = {
    levels: [
      { id: "low", label: "Low" },
      { id: "high", label: "High" },
    ],
    default: "high",
  }

  it("carries the runtime's declared reasoning scale verbatim", () => {
    expect(
      listedModelSchema.parse({ id: "m", reasoning: scale }).reasoning,
    ).toEqual(scale)
  })

  it("rejects a scale whose default names no offered level", () => {
    expect(
      listedModelSchema.safeParse({
        id: "m",
        reasoning: { ...scale, default: "max" },
      }).success,
    ).toBe(false)
  })

  it("refuses a scale that names no levels, which declares nothing", () => {
    expect(
      listedModelSchema.safeParse({
        id: "m",
        reasoning: { levels: [], default: "high" },
      }).success,
    ).toBe(false)
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
    const good = { id: "gpt-4o", context_window: 128_000 }
    const withoutAnId = { display_name: "a model that never sent one" }

    expect(
      providerModelsResponseSchema.safeParse(catalogue([good])).success,
    ).toBe(true)
    expect(
      providerModelsResponseSchema.safeParse(catalogue([good, withoutAnId]))
        .success,
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
