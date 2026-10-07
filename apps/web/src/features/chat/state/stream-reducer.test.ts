import { describe, expect, it } from "bun:test"
import type { AgentStreamEvent } from "@/lib/schemas/agent-stream"
import {
  describeStreamError,
  streamErrorTitle,
} from "../hooks/use-agent-stream"
import {
  type ActiveTurnProjection,
  applyStreamFrame,
  initialTurnProjection,
  isSettled,
  streamReducer,
} from "./stream-reducer"

describe("streamReducer (Pure Event Reducer)", () => {
  const threadId = "0191eb5d-7a6c-7e6d-9290-349c2a61c3e1"
  const turnId = "0191eb5d-7a6c-7e6d-9290-349c2a61c3e2"
  const itemId = "0191eb5d-7a6c-7e6d-9290-349c2a61c3e3"

  it("handles turn_started by resetting state and setting streaming status", () => {
    const dirtyState: ActiveTurnProjection = {
      ...initialTurnProjection,
      threadId: "old-thread",
      turnId: "old-turn",
      activeItemId: "old-item",
      streamingText: "Old response",
      streamingThinking: "Old thoughts",
      status: "completed",
      error: "Old error",
    }

    const event: AgentStreamEvent = {
      type: "turn_started",
      data: { thread_id: threadId, turn_id: turnId },
    }

    const next = streamReducer(dirtyState, event)
    expect(next).toEqual({
      ...initialTurnProjection,
      threadId,
      turnId,
      // A new turn does not inherit the previous turn's active item.
      activeItemId: null,
      status: "streaming",
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
        delta: { kind: "thinking_delta", block_id: "r-1", text: "Analyzing " },
      },
    }
    const think2: AgentStreamEvent = {
      type: "item_delta",
      data: {
        item_id: itemId,
        delta: {
          kind: "thinking_delta",
          block_id: "r-1",
          text: "summer batch data...",
        },
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
    const activeState: ActiveTurnProjection = {
      ...initialTurnProjection,
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
    const activeState: ActiveTurnProjection = {
      ...initialTurnProjection,
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
    const activeState: ActiveTurnProjection = {
      ...initialTurnProjection,
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

  it("reports a suspended turn as suspended, not as an error or a finish", () => {
    const event: AgentStreamEvent = {
      type: "turn_suspended",
      data: {
        thread_id: threadId,
        turn_id: turnId,
        item_id: itemId,
        attempt: 1,
      },
    }

    const next = streamReducer(
      { ...initialTurnProjection, status: "streaming" },
      event,
    )
    expect(next.status).toBe("suspended")
    expect(isSettled(next.status)).toBe(false)
    expect(next.awaitingApprovalItemId).toBe(itemId)
    expect(next.approvalAttempt).toBe(1)
  })

  it("returns to streaming when a suspended turn is resumed", () => {
    const suspended: ActiveTurnProjection = {
      ...initialTurnProjection,
      status: "suspended",
      awaitingApprovalItemId: itemId,
      approvalAttempt: 1,
    }

    const next = streamReducer(suspended, {
      type: "turn_resumed",
      data: {
        thread_id: threadId,
        turn_id: turnId,
        attempt: 2,
        decision: "approved",
      },
    })
    expect(next.status).toBe("streaming")
    // A stale decision prompt is worse than none.
    expect(next.awaitingApprovalItemId).toBeNull()
  })

  it("keeps the server's own reason for a turn ending", () => {
    const cases = [
      ["completed", "completed"],
      ["failed", "failed"],
      ["cancelled", "cancelled"],
    ] as const

    for (const [serverStatus, expected] of cases) {
      const next = streamReducer(
        { ...initialTurnProjection, status: "streaming" },
        {
          type: "turn_completed",
          data: {
            thread_id: threadId,
            turn_id: turnId,
            status: serverStatus,
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
          },
        },
      )
      expect(next.status).toBe(expected)
      expect(isSettled(next.status)).toBe(true)
    }
  })

  it("clears the approval item when the turn finishes", () => {
    const next = streamReducer(
      {
        ...initialTurnProjection,
        status: "suspended",
        awaitingApprovalItemId: itemId,
        approvalAttempt: 1,
      },
      {
        type: "turn_completed",
        data: {
          thread_id: threadId,
          turn_id: turnId,
          status: "completed",
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        },
      },
    )
    expect(next.awaitingApprovalItemId).toBeNull()
  })

  it("accumulates tool argument deltas separately from text", () => {
    const next = streamReducer(initialTurnProjection, {
      type: "item_delta",
      data: {
        item_id: itemId,
        delta: { kind: "tool_arguments_delta", text: '{"text":' },
      },
    })
    expect(next.streamingToolArguments).toBe('{"text":')
    expect(next.streamingText).toBe("")
  })

  it("ignores a frame it cannot model instead of ending the turn", () => {
    // The server adds capability as new event types so older clients keep
    // working. Throwing here would defeat that on the first unknown frame.
    const reported: { error: string; received: unknown }[] = []
    const streaming: ActiveTurnProjection = {
      ...initialTurnProjection,
      status: "streaming",
      streamingText: "kept",
    }

    const next = applyStreamFrame(
      streaming,
      { type: "telemetry_sample", data: { latency_ms: 12 } },
      (detail) => reported.push(detail),
    )

    expect(next).toBe(streaming)
    expect(reported).toHaveLength(1)
    expect(reported[0]?.error).toContain("")
  })

  it("still applies frames it can model", () => {
    const next = applyStreamFrame(initialTurnProjection, {
      type: "turn_started",
      data: { thread_id: threadId, turn_id: turnId },
    })
    expect(next.status).toBe("streaming")
    expect(next.threadId).toBe(threadId)
  })
})

describe("a failure keeps its code", () => {
  const threadId = "0191eb5d-7a6c-7e6d-9290-349c2a61c3e1"
  const turnId = "0191eb5d-7a6c-7e6d-9290-349c2a61c3e2"

  it("carries both what happened and why", () => {
    // The code is the discriminating half. It used to be validated and then
    // thrown away, which is why a gateway that was not running and a provider
    // that refused looked the same on screen.
    const next = streamReducer(initialTurnProjection, {
      type: "stream_error",
      data: {
        code: "model_provider_unreachable",
        message: "the model provider could not be reached",
      },
    })

    expect(next.error).toBe("the model provider could not be reached")
    expect(next.errorCode).toBe("model_provider_unreachable")
  })

  it("distinguishes an unreachable provider from one that refused", () => {
    const unreachable = streamReducer(initialTurnProjection, {
      type: "stream_error",
      data: {
        code: "model_provider_unreachable",
        message: "the model provider could not be reached",
      },
    })
    const refused = streamReducer(initialTurnProjection, {
      type: "stream_error",
      data: {
        code: "model_provider_rejected",
        message: "the model provider rejected the request",
      },
    })

    expect(unreachable.errorCode).not.toBe(refused.errorCode)
  })

  it("does not carry a previous turn's failure into the next one", () => {
    const failed = streamReducer(initialTurnProjection, {
      type: "stream_error",
      data: { code: "model_timeout", message: "did not respond in time" },
    })
    const next = streamReducer(failed, {
      type: "turn_started",
      data: { thread_id: threadId, turn_id: turnId },
    })

    expect(next.error).toBeNull()
    expect(next.errorCode).toBeNull()
  })
})

describe("reasoning blocks", () => {
  const itemId = "0191eb5d-7a6c-7e6d-9290-349c2a61c3e3"

  function thinking(blockId: string, text: string) {
    return {
      type: "item_delta",
      data: {
        item_id: itemId,
        delta: { kind: "thinking_delta", block_id: blockId, text },
      },
    } as const
  }

  it("keeps one block's fragments together", () => {
    const once = streamReducer(initialTurnProjection, thinking("a", "first"))
    const twice = streamReducer(once, thinking("a", " second"))
    expect(twice.streamingThinking).toBe("first second")
    expect(twice.streamingThinkingBlockId).toBe("a")
  })

  it("starts a new thought when the provider starts a new block", () => {
    // The provider can think, call a tool, and think again. Without the block id
    // the two run together and read as one continuous train of thought that never
    // went anywhere.
    const first = streamReducer(
      initialTurnProjection,
      thinking("a", "about the question"),
    )
    const second = streamReducer(first, thinking("b", "about the answer"))

    expect(second.streamingThinking).toBe("about the answer")
    expect(second.streamingThinkingBlockId).toBe("b")
  })

  it("does not inherit a block into the next turn", () => {
    const streaming = streamReducer(
      initialTurnProjection,
      thinking("a", "thinking"),
    )
    const next = streamReducer(streaming, {
      type: "turn_started",
      data: {
        thread_id: "0191eb5d-7a6c-7e6d-9290-349c2a61c3e1",
        turn_id: "0191eb5d-7a6c-7e6d-9290-349c2a61c3e2",
      },
    })
    expect(next.streamingThinking).toBe("")
    expect(next.streamingThinkingBlockId).toBeNull()
  })
})

describe("naming a turn that could not run", () => {
  it("names the workspace setup problem rather than the subsystem", () => {
    // The code the runtime sends when nothing is configured yet. Calling this an
    // "Agent error" sends the reader looking at the agent instead of at settings.
    expect(streamErrorTitle("tenant_provider_unconfigured")).toBe(
      "This workspace has no model provider",
    )
  })

  it("does not blame the user for a deployment-level refusal", () => {
    expect(streamErrorTitle("tenant_provider_endpoint_blocked")).toBe(
      "The model endpoint is unreachable from the runtime",
    )
  })

  it("tells the user when the provider rejected their API key", () => {
    expect(streamErrorTitle("model_provider_auth_rejected")).toBe(
      "The provider rejected its API key",
    )
    expect(
      describeStreamError(
        "the provider rejected its API key; check the key in provider settings",
        "model_provider_auth_rejected",
        "req-1",
      ),
    ).toContain("check the key in provider settings")
  })

  it("points to the endpoint or model when the provider returns 404", () => {
    expect(streamErrorTitle("model_provider_not_found")).toBe(
      "The provider could not find that endpoint or model",
    )
  })

  it("identifies a temporary provider overload and suggests retrying", () => {
    expect(streamErrorTitle("model_provider_overloaded")).toBe(
      "The model provider is temporarily overloaded",
    )
    expect(
      describeStreamError(
        "the model provider is temporarily overloaded; try again shortly",
        "model_provider_overloaded",
        "req-1",
      ),
    ).toContain("try again shortly")
  })

  it("keeps the generic title for everything it does not recognise", () => {
    // Including a code it has never heard of, which is what makes the mapping
    // forward-compatible: an older client talking to a newer runtime still says
    // something true.
    expect(streamErrorTitle("TURN_STEP_FAILED")).toBe("Agent error")
    expect(streamErrorTitle("model_provider_unreachable")).toBe("Agent error")
    expect(streamErrorTitle("something_invented_later")).toBe("Agent error")
    expect(streamErrorTitle("")).toBe("Agent error")
  })

  it("keeps the runtime's own sentence and the reference in the description", () => {
    const description = describeStreamError(
      "this workspace has no model provider configured yet",
      "tenant_provider_unconfigured",
      "req-1",
    )
    expect(description).toContain("no model provider configured yet")
    expect(description).toContain("tenant_provider_unconfigured")
    expect(description).toContain("req-1")
  })
})
