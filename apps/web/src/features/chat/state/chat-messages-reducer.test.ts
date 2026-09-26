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
})
