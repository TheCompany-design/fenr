import { describe, expect, it } from "bun:test"
import type { AgentStreamEvent } from "@/lib/schemas/agent-stream"
import type { ChatMessage } from "../types"
import { chatMessagesReducer } from "./chat-messages-reducer"

describe("chatMessagesReducer (Pure In-Place Message Stream Reducer)", () => {
  const initialMessages: ChatMessage[] = [
    {
      id: "prev-user",
      role: "user",
      content: "Prior prompt",
      status: "completed",
    },
    {
      id: "prev-agent",
      role: "agent",
      content: "Prior response",
      status: "completed",
    },
  ]

  it("handles client_send by appending user message and streaming agent placeholder", () => {
    const userMsg: ChatMessage = {
      id: "user-1",
      role: "user",
      content: "Hello Nabu",
      status: "completed",
    }
    const agentMsg: ChatMessage = {
      id: "placeholder-agent",
      role: "agent",
      content: "",
      status: "streaming",
    }

    const next = chatMessagesReducer(initialMessages, {
      type: "client_send",
      payload: { userMessage: userMsg, agentMessage: agentMsg },
    })

    expect(next).toHaveLength(4)
    expect(next[2]).toEqual(userMsg)
    expect(next[3]).toEqual(agentMsg)
  })

  it("handles item_started by updating the streaming agent message id to server item_id", () => {
    const messages: ChatMessage[] = [
      {
        id: "placeholder-agent",
        role: "agent",
        content: "",
        status: "streaming",
      },
    ]

    const event: AgentStreamEvent = {
      type: "item_started",
      data: {
        thread_id: "thread-1",
        turn_id: "turn-1",
        item_id: "server-item-123",
        kind: "agent_message",
      },
    }

    const next = chatMessagesReducer(messages, {
      type: "agent_event",
      event,
    })

    expect(next).toHaveLength(1)
    expect(next[0]?.id).toBe("server-item-123")
    expect(next[0]?.status).toBe("streaming")
  })

  it("accumulates text and thinking deltas in-place without creating extra items", () => {
    let messages: ChatMessage[] = [
      {
        id: "item-123",
        role: "agent",
        content: "",
        thinking: "",
        status: "streaming",
      },
    ]

    const thinkDelta: AgentStreamEvent = {
      type: "item_delta",
      data: {
        item_id: "item-123",
        delta: { kind: "thinking_delta", text: "Reasoning..." },
      },
    }

    const textDelta1: AgentStreamEvent = {
      type: "item_delta",
      data: {
        item_id: "item-123",
        delta: { kind: "text_delta", text: "Mint " },
      },
    }

    const textDelta2: AgentStreamEvent = {
      type: "item_delta",
      data: {
        item_id: "item-123",
        delta: { kind: "text_delta", text: "chip is available." },
      },
    }

    messages = chatMessagesReducer(messages, {
      type: "agent_event",
      event: thinkDelta,
    })
    messages = chatMessagesReducer(messages, {
      type: "agent_event",
      event: textDelta1,
    })
    messages = chatMessagesReducer(messages, {
      type: "agent_event",
      event: textDelta2,
    })

    expect(messages).toHaveLength(1)
    expect(messages[0]?.content).toBe("Mint chip is available.")
    expect(messages[0]?.thinking).toBe("Reasoning...")
    expect(messages[0]?.status).toBe("streaming")
  })

  it("handles turn_completed by transitioning streaming message status to completed", () => {
    const messages: ChatMessage[] = [
      {
        id: "item-123",
        role: "agent",
        content: "Completed text",
        status: "streaming",
      },
    ]

    const next = chatMessagesReducer(messages, {
      type: "agent_event",
      event: {
        type: "turn_completed",
        data: {
          thread_id: "thread-1",
          turn_id: "turn-1",
          status: "completed",
          usage: {
            prompt_tokens: 10,
            completion_tokens: 10,
            total_tokens: 20,
          },
        },
      },
    })

    expect(next).toHaveLength(1)
    expect(next[0]?.status).toBe("completed")
    expect(next[0]?.content).toBe("Completed text")
  })

  it("handles stream_stopped by marking active streaming message completed", () => {
    const messages: ChatMessage[] = [
      {
        id: "item-123",
        role: "agent",
        content: "Partial response",
        status: "streaming",
      },
    ]

    const next = chatMessagesReducer(messages, {
      type: "stream_stopped",
    })

    expect(next).toHaveLength(1)
    expect(next[0]?.status).toBe("completed")
    expect(next[0]?.content).toBe("Partial response")
  })

  it("handles stream_error by marking active streaming message error", () => {
    const messages: ChatMessage[] = [
      {
        id: "item-123",
        role: "agent",
        content: "Before failure",
        status: "streaming",
      },
    ]

    const next = chatMessagesReducer(messages, {
      type: "agent_event",
      event: {
        type: "stream_error",
        data: {
          code: "INTERNAL_ERROR",
          message: "Upstream failure",
        },
      },
    })

    expect(next).toHaveLength(1)
    expect(next[0]?.status).toBe("error")
  })

  describe("transcript items that are not bubbles", () => {
    const threadId = "0191eb5d-7a6c-7e6d-9290-349c2a61c3e1"
    const turnId = "0191eb5d-7a6c-7e6d-9290-349c2a61c3e2"
    const itemId = "0191eb5d-7a6c-7e6d-9290-349c2a61c3e3"
    const toolItemId = "0191eb5d-7a6c-7e6d-9290-349c2a61c3e4"

    function streaming(): ChatMessage[] {
      return [
        { id: "local-1", role: "user", content: "hi", status: "completed" },
        { id: "local-2", role: "agent", content: "", status: "streaming" },
      ]
    }

    function apply(messages: ChatMessage[], event: AgentStreamEvent) {
      return chatMessagesReducer(messages, { type: "agent_event", event })
    }

    it("does not rename the streaming bubble to a tool item", () => {
      // Adopting a tool item's id here would send every later text delta to a
      // message that does not exist, splitting one answer into two bubbles.
      const next = apply(streaming(), {
        type: "item_started",
        data: {
          thread_id: threadId,
          turn_id: turnId,
          item_id: toolItemId,
          kind: "tool_call",
        },
      })
      expect(next[1]?.id).toBe("local-2")
    })

    it("does not rename the streaming bubble to an approval request", () => {
      const next = apply(streaming(), {
        type: "item_started",
        data: {
          thread_id: threadId,
          turn_id: turnId,
          item_id: toolItemId,
          kind: "approval_request",
        },
      })
      expect(next[1]?.id).toBe("local-2")
    })

    it("still adopts the id of a real message item", () => {
      const next = apply(streaming(), {
        type: "item_started",
        data: {
          thread_id: threadId,
          turn_id: turnId,
          item_id: itemId,
          kind: "agent_message",
        },
      })
      expect(next[1]?.id).toBe(itemId)
    })

    it("ignores tool argument deltas rather than writing them into the answer", () => {
      const messages = streaming().map((message) =>
        message.id === "local-2" ? { ...message, id: itemId } : message,
      )
      const next = apply(messages, {
        type: "item_delta",
        data: {
          item_id: itemId,
          delta: { kind: "tool_arguments_delta", text: '{"text":' },
        },
      })
      expect(next[1]?.content).toBe("")
    })

    it("ignores a completed tool result", () => {
      const next = apply(streaming(), {
        type: "item_completed",
        data: {
          item_id: toolItemId,
          payload: {
            kind: "tool_result",
            call_id: "call_1",
            name: "echo",
            output: "ok",
            truncated: false,
            outcome: "succeeded",
          },
        },
      })
      expect(next).toEqual(streaming())
    })
  })

  describe("turn lifecycle the server can now report", () => {
    const threadId = "0191eb5d-7a6c-7e6d-9290-349c2a61c3e1"
    const turnId = "0191eb5d-7a6c-7e6d-9290-349c2a61c3e2"

    function streaming(): ChatMessage[] {
      return [
        { id: "user-1", role: "user", content: "hi", status: "completed" },
        {
          id: "agent-1",
          role: "agent",
          content: "partial",
          status: "streaming",
        },
      ]
    }

    it("settles the bubble when a turn suspends for approval", () => {
      // Not an error: the turn is parked on a decision, and a bubble left in
      // "streaming" reads as a request that never came back.
      const next = chatMessagesReducer(streaming(), {
        type: "agent_event",
        event: {
          type: "turn_suspended",
          data: {
            thread_id: threadId,
            turn_id: turnId,
            item_id: "0191eb5d-7a6c-7e6d-9290-349c2a61c3e3",
            attempt: 1,
          },
        },
      })
      expect(next[1]?.status).toBe("completed")
      expect(next[1]?.content).toBe("partial")
    })

    it("marks the bubble as an error when the turn fails", () => {
      const next = chatMessagesReducer(streaming(), {
        type: "agent_event",
        event: {
          type: "turn_completed",
          data: {
            thread_id: threadId,
            turn_id: turnId,
            status: "failed",
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
          },
        },
      })
      expect(next[1]?.status).toBe("error")
    })

    it("keeps a cancelled turn's partial answer as completed", () => {
      // A cancelled turn is one the reader stopped; dressing it as a failure
      // would blame them for the model's failure.
      const next = chatMessagesReducer(streaming(), {
        type: "agent_event",
        event: {
          type: "turn_completed",
          data: {
            thread_id: threadId,
            turn_id: turnId,
            status: "cancelled",
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
          },
        },
      })
      expect(next[1]?.status).toBe("completed")
      expect(next[1]?.content).toBe("partial")
    })

    it("leaves settled messages alone when a suspended turn resumes", () => {
      const before = streaming().map((message) => ({
        ...message,
        status: "completed" as const,
      }))
      const next = chatMessagesReducer(before, {
        type: "agent_event",
        event: {
          type: "turn_resumed",
          data: {
            thread_id: threadId,
            turn_id: turnId,
            attempt: 2,
            decision: "approved",
          },
        },
      })
      expect(next).toEqual(before)
    })
  })
})
