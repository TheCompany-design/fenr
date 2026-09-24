import { describe, expect, it } from "bun:test"
import {
  agentStreamEventSchema,
  chatComposerSchema,
  itemDeltaPayloadSchema,
  itemKindSchema,
  itemPayloadSchema,
  turnStatusSchema,
  usageReportSchema,
} from "./agent-stream"

describe("agent-stream schemas", () => {
  it("validates turnStatusSchema correctly", () => {
    expect(turnStatusSchema.parse("completed")).toBe("completed")
    expect(turnStatusSchema.parse("failed")).toBe("failed")
    expect(() => turnStatusSchema.parse("unknown")).toThrow()
  })

  it("validates itemKindSchema correctly", () => {
    expect(itemKindSchema.parse("user_message")).toBe("user_message")
    expect(itemKindSchema.parse("agent_message")).toBe("agent_message")
    expect(() => itemKindSchema.parse("system_message")).toThrow()
  })

  it("validates itemDeltaPayloadSchema for text and thinking deltas", () => {
    const textDelta = itemDeltaPayloadSchema.parse({
      kind: "text_delta",
      text: "Hello world",
    })
    expect(textDelta).toEqual({ kind: "text_delta", text: "Hello world" })

    const thinkingDelta = itemDeltaPayloadSchema.parse({
      kind: "thinking_delta",
      text: "Analyzing...",
    })
    expect(thinkingDelta).toEqual({
      kind: "thinking_delta",
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
