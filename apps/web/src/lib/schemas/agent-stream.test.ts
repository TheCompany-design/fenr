import { describe, expect, it } from "bun:test"
import {
  AGENT_STREAM_EVENT_TYPES,
  agentStreamEventSchema,
  chatComposerSchema,
  itemDeltaPayloadSchema,
  itemKindSchema,
  itemPayloadSchema,
  MESSAGE_ITEM_KINDS,
  parseAgentStreamEvent,
  TERMINAL_TURN_STATUSES,
  turnStatusSchema,
  usageReportSchema,
} from "./agent-stream"
import { ALL_AGENT_STREAM_FIXTURES } from "./agent-stream.fixtures"

describe("agent-stream schemas", () => {
  it("validates turnStatusSchema correctly", () => {
    for (const status of [
      "in_progress",
      "completed",
      "failed",
      "suspended",
      "cancelled",
    ] as const) {
      expect(turnStatusSchema.parse(status)).toBe(status)
    }
    expect(() => turnStatusSchema.parse("unknown")).toThrow()
  })

  it("treats only completed, failed and cancelled as terminal", () => {
    // `suspended` is excluded on purpose: it is waiting on a human, and a client
    // that treated it as settled would strand the turn.
    expect([...TERMINAL_TURN_STATUSES]).toEqual([
      "completed",
      "failed",
      "cancelled",
    ])
    expect(TERMINAL_TURN_STATUSES).not.toContain("suspended")
  })

  it("validates itemKindSchema correctly", () => {
    for (const kind of [
      "user_message",
      "agent_message",
      "tool_call",
      "tool_result",
      "approval_request",
      "approval_decision",
    ] as const) {
      expect(itemKindSchema.parse(kind)).toBe(kind)
    }
    expect(() => itemKindSchema.parse("system_message")).toThrow()
  })

  it("separates message kinds from the rest", () => {
    // The chat timeline renders these; tool and approval items are transcript
    // records, not bubbles, so they must not be lumped together.
    expect([...MESSAGE_ITEM_KINDS]).toEqual(["user_message", "agent_message"])
  })

  it("validates itemDeltaPayloadSchema for text and thinking deltas", () => {
    const textDelta = itemDeltaPayloadSchema.parse({
      kind: "text_delta",
      text: "Hello world",
    })
    expect(textDelta).toEqual({ kind: "text_delta", text: "Hello world" })

    const thinkingDelta = itemDeltaPayloadSchema.parse({
      kind: "thinking_delta",
      block_id: "r-1",
      text: "Analyzing...",
    })
    expect(thinkingDelta).toEqual({
      kind: "thinking_delta",
      block_id: "r-1",
      text: "Analyzing...",
    })

    expect(() =>
      itemDeltaPayloadSchema.parse({ kind: "unknown_delta", text: "error" }),
    ).toThrow()
  })

  it("validates itemPayloadSchema for user and agent messages", () => {
    const userMsg = itemPayloadSchema.parse({
      kind: "user_message",
      content: "What is my balance?",
    })
    expect(userMsg).toEqual({
      kind: "user_message",
      content: "What is my balance?",
    })

    const agentMsg = itemPayloadSchema.parse({
      kind: "agent_message",
      text: "Your balance is $42.00",
      thinking: "Checked ledger table",
    })
    expect(agentMsg).toEqual({
      kind: "agent_message",
      text: "Your balance is $42.00",
      thinking: "Checked ledger table",
    })

    const agentMsgNoThinking = itemPayloadSchema.parse({
      kind: "agent_message",
      text: "Hello",
    })
    expect(agentMsgNoThinking.kind).toBe("agent_message")
    if (agentMsgNoThinking.kind === "agent_message") {
      expect(agentMsgNoThinking.text).toBe("Hello")
    }
  })

  it("validates usageReportSchema", () => {
    const usage = usageReportSchema.parse({
      prompt_tokens: 15,
      completion_tokens: 30,
      total_tokens: 45,
    })
    expect(usage.total_tokens).toBe(45)

    expect(() =>
      usageReportSchema.parse({
        prompt_tokens: -1,
        completion_tokens: 0,
        total_tokens: 0,
      }),
    ).toThrow()
  })

  it("validates all agentStreamEventSchema variants", () => {
    const threadId = "0191eb5d-7a6c-7e6d-9290-349c2a61c3e1"
    const turnId = "0191eb5d-7a6c-7e6d-9290-349c2a61c3e2"
    const itemId = "0191eb5d-7a6c-7e6d-9290-349c2a61c3e3"

    // turn_started
    const turnStarted = agentStreamEventSchema.parse({
      type: "turn_started",
      data: { thread_id: threadId, turn_id: turnId },
    })
    expect(turnStarted.type).toBe("turn_started")

    // item_started
    const itemStarted = agentStreamEventSchema.parse({
      type: "item_started",
      data: {
        thread_id: threadId,
        turn_id: turnId,
        item_id: itemId,
        kind: "agent_message",
      },
    })
    expect(itemStarted.type).toBe("item_started")

    // item_delta
    const itemDelta = agentStreamEventSchema.parse({
      type: "item_delta",
      data: {
        item_id: itemId,
        delta: { kind: "text_delta", text: "Hello" },
      },
    })
    expect(itemDelta.type).toBe("item_delta")

    // item_completed
    const itemCompleted = agentStreamEventSchema.parse({
      type: "item_completed",
      data: {
        item_id: itemId,
        payload: {
          kind: "agent_message",
          text: "Hello world",
        },
      },
    })
    expect(itemCompleted.type).toBe("item_completed")

    // turn_completed
    const turnCompleted = agentStreamEventSchema.parse({
      type: "turn_completed",
      data: {
        thread_id: threadId,
        turn_id: turnId,
        status: "completed",
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      },
    })
    expect(turnCompleted.type).toBe("turn_completed")

    // stream_error
    const streamError = agentStreamEventSchema.parse({
      type: "stream_error",
      data: {
        code: "RATE_LIMITED",
        message: "Model rate limit exceeded",
      },
    })
    expect(streamError.type).toBe("stream_error")
  })

  it("parses every event captured from the server", () => {
    // These fixtures were serialised by the Rust implementation. If the server
    // changes shape, this is where it is caught.
    for (const fixture of ALL_AGENT_STREAM_FIXTURES) {
      const parsed = agentStreamEventSchema.safeParse(fixture)
      if (!parsed.success) {
        throw new Error(
          `server event no longer parses: ${JSON.stringify(fixture)}\n${parsed.error.message}`,
        )
      }
      // The fixture's own `type` is widened by `as const` over an array, so
      // compare as strings rather than asserting the union back onto itself.
      expect(parsed.data.type as string).toBe(fixture.type as string)
    }
  })

  it("accepts every event type the server emits", () => {
    const seen = new Set(
      ALL_AGENT_STREAM_FIXTURES.map((fixture) => fixture.type),
    )
    expect([...seen].sort()).toEqual([...AGENT_STREAM_EVENT_TYPES].sort())
  })

  it("keeps tool arguments unvalidated rather than rejecting them", () => {
    // The runtime buffers argument deltas until they parse, so anything can
    // legitimately arrive here.
    const payload = itemPayloadSchema.parse({
      kind: "tool_call",
      call_id: "call_1",
      name: "echo",
      arguments: "not json yet",
    })
    expect(payload.kind).toBe("tool_call")
  })

  it("rejects a tool result with no outcome", () => {
    // `outcome` is not optional: an unclassified result is exactly the ambiguity
    // the `unknown` variant exists to name.
    expect(() =>
      itemPayloadSchema.parse({
        kind: "tool_result",
        call_id: "call_1",
        name: "echo",
        output: "ok",
        truncated: false,
      }),
    ).toThrow()
  })

  it("reports a parse failure instead of throwing", () => {
    const result = parseAgentStreamEvent({ type: "not_a_real_event" })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.length).toBeGreaterThan(0)
    }

    const good = parseAgentStreamEvent(ALL_AGENT_STREAM_FIXTURES[0])
    expect(good.ok).toBe(true)
  })

  it("validates chatComposerSchema with trimming and empty checks", () => {
    expect(chatComposerSchema.parse({ prompt: "  hello world  " })).toEqual({
      prompt: "hello world",
    })

    expect(() => chatComposerSchema.parse({ prompt: "" })).toThrow(
      "Message cannot be empty",
    )
    expect(() => chatComposerSchema.parse({ prompt: "   " })).toThrow(
      "Message cannot be empty",
    )
  })
})
