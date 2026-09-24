import { describe, expect, it } from "bun:test"
import type { AgentStreamEvent } from "@/lib/schemas/agent-stream"
import { initialTurnProjection, streamReducer } from "./stream-reducer"

describe("streamReducer (Pure Event Reducer)", () => {
  const threadId = "0191eb5d-7a6c-7e6d-9290-349c2a61c3e1"
  const turnId = "0191eb5d-7a6c-7e6d-9290-349c2a61c3e2"
  const itemId = "0191eb5d-7a6c-7e6d-9290-349c2a61c3e3"

  it("handles turn_started by resetting state and setting streaming status", () => {
    const dirtyState = {
      threadId: "old-thread",
      turnId: "old-turn",
      activeItemId: "old-item",
      streamingText: "Old response",
      streamingThinking: "Old thoughts",
      status: "completed" as const,
      error: "Old error",
    }

    const event: AgentStreamEvent = {
      type: "turn_started",
      data: { thread_id: threadId, turn_id: turnId },
    }

    const next = streamReducer(dirtyState, event)
    expect(next).toEqual({
      threadId,
      turnId,
      activeItemId: "old-item",
      streamingText: "",
      streamingThinking: "",
      status: "streaming",
      error: null,
    })
  })

  it("handles item_started by tracking active item id", () => {
    const event: AgentStreamEvent = {
      type: "item_started",
      data: {
        thread_id: threadId,
        turn_id: turnId,
        item_id: itemId,
        kind: "agent_message",
      },
    }

    const next = streamReducer(initialTurnProjection, event)
    expect(next.activeItemId).toBe(itemId)
  })

  it("accumulates text deltas smoothly", () => {
    let state = streamReducer(initialTurnProjection, {
      type: "turn_started",
      data: { thread_id: threadId, turn_id: turnId },
    })

    const delta1: AgentStreamEvent = {
      type: "item_delta",
      data: {
        item_id: itemId,
        delta: { kind: "text_delta", text: "Pistachio " },
      },
    }
    const delta2: AgentStreamEvent = {
      type: "item_delta",
      data: {
        item_id: itemId,
        delta: { kind: "text_delta", text: "sales are up 23%." },
      },
    }

    state = streamReducer(state, delta1)
    expect(state.streamingText).toBe("Pistachio ")

    state = streamReducer(state, delta2)
    expect(state.streamingText).toBe("Pistachio sales are up 23%.")
  })

  it("accumulates thinking deltas separately from text deltas", () => {
    let state = streamReducer(initialTurnProjection, {
      type: "turn_started",
      data: { thread_id: threadId, turn_id: turnId },
    })

    const think1: AgentStreamEvent = {
      type: "item_delta",
      data: {
        item_id: itemId,
        delta: { kind: "thinking_delta", text: "Analyzing " },
      },
    }
    const think2: AgentStreamEvent = {
      type: "item_delta",
      data: {
        item_id: itemId,
        delta: { kind: "thinking_delta", text: "summer batch data..." },
      },
    }
    const text1: AgentStreamEvent = {
      type: "item_delta",
      data: {
        item_id: itemId,
        delta: { kind: "text_delta", text: "Results ready." },
      },
    }

    state = streamReducer(state, think1)
    state = streamReducer(state, think2)
    state = streamReducer(state, text1)

    expect(state.streamingThinking).toBe("Analyzing summer batch data...")
    expect(state.streamingText).toBe("Results ready.")
  })

  it("handles item_completed safely without altering accumulated deltas", () => {
    const activeState = {
      threadId,
      turnId,
      activeItemId: itemId,
      streamingText: "Completed text",
      streamingThinking: "Completed thinking",
      status: "streaming" as const,
      error: null,
    }

    const event: AgentStreamEvent = {
      type: "item_completed",
      data: {
        item_id: itemId,
        payload: {
          kind: "agent_message",
          text: "Completed text",
          thinking: "Completed thinking",
        },
      },
    }

    const next = streamReducer(activeState, event)
    expect(next).toEqual(activeState)
  })

  it("handles turn_completed by setting status to completed", () => {
    const activeState = {
      threadId,
      turnId,
      activeItemId: itemId,
      streamingText: "Final message",
      streamingThinking: "",
      status: "streaming" as const,
      error: null,
    }

    const event: AgentStreamEvent = {
      type: "turn_completed",
      data: {
        thread_id: threadId,
        turn_id: turnId,
        status: "completed",
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      },
    }

    const next = streamReducer(activeState, event)
    expect(next.status).toBe("completed")
    expect(next.streamingText).toBe("Final message")
  })

  it("handles stream_error by transitioning to error state with diagnostic message", () => {
    const activeState = {
      threadId,
      turnId,
      activeItemId: itemId,
      streamingText: "Partial text",
      streamingThinking: "",
      status: "streaming" as const,
      error: null,
    }

    const event: AgentStreamEvent = {
      type: "stream_error",
      data: {
        code: "MODEL_TIMEOUT",
        message: "Upstream LLM provider timed out after 30s",
      },
    }

    const next = streamReducer(activeState, event)
    expect(next.status).toBe("error")
    expect(next.error).toBe("Upstream LLM provider timed out after 30s")
    expect(next.streamingText).toBe("Partial text")
  })
})
