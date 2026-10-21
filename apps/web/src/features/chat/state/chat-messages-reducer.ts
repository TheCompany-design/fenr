import {
  type AgentStreamEvent,
  isMessageItemKind,
} from "@/lib/schemas/agent-stream"
import type { ChatMessage } from "../types"

export type ClientChatAction =
  | {
      readonly type: "client_send"
      readonly payload: {
        readonly userMessage: ChatMessage
        readonly agentMessage: ChatMessage
      }
    }
  | {
      readonly type: "stream_stopped"
    }

export type ChatMessageAction =
  | ClientChatAction
  | {
      readonly type: "agent_event"
      readonly event: AgentStreamEvent
    }

function reduceAgentEvent(
  messages: readonly ChatMessage[],
  event: AgentStreamEvent,
): ChatMessage[] {
  switch (event.type) {
    case "turn_started": {
      return [...messages]
    }

    case "item_started": {
      const { item_id, kind } = event.data

      if (!isMessageItemKind(kind)) {
        return [...messages]
      }

      const lastIdx = messages.length - 1
      const current = messages[lastIdx]

      const claimable =
        lastIdx >= 0 &&
        current?.role === "agent" &&
        current.status === "streaming" &&
        current.unclaimed === true

      if (claimable && current) {
        const { unclaimed: _claimed, ...claimed } = current
        const updated = [...messages]
        updated[lastIdx] = { ...claimed, id: item_id }
        return updated
      }

      const settled = messages.map((message) =>
        message.status === "streaming"
          ? { ...message, status: "completed" as const }
          : message,
      )
      return [
        ...settled,
        {
          id: item_id,
          role: "agent" as const,
          content: "",
          thinking: "",
          status: "streaming" as const,
        },
      ]
    }

    case "item_delta": {
      const { item_id, delta } = event.data
      const lastIdx = messages.length - 1
      if (lastIdx < 0) return [...messages]

      const targetIdx = messages.findIndex((m) => m.id === item_id)
      const idxToUpdate =
        targetIdx !== -1
          ? targetIdx
          : messages[lastIdx]?.status === "streaming"
            ? lastIdx
            : -1

      if (delta.kind === "tool_arguments_delta") {
        return [...messages]
      }

      const target = idxToUpdate === -1 ? undefined : messages[idxToUpdate]
      if (!target) return [...messages]

      const updated = [...messages]
      if (delta.kind === "text_delta") {
        updated[idxToUpdate] = {
          ...target,
          content: target.content + delta.text,
        }
      } else if (delta.kind === "thinking_delta") {
        updated[idxToUpdate] = {
          ...target,
          thinking: (target.thinking ?? "") + delta.text,
        }
      }

      return updated
    }

    case "item_completed": {
      const { item_id, payload } = event.data

      if (payload.kind !== "agent_message" && payload.kind !== "user_message") {
        return [...messages]
      }

      return messages.map((msg) => {
        if (msg.id !== item_id) {
          return msg
        }
        if (payload.kind === "agent_message") {
          return {
            ...msg,
            content: payload.text || msg.content,
            thinking:
              payload.thinking !== undefined ? payload.thinking : msg.thinking,
          }
        }
        return { ...msg, content: payload.content || msg.content }
      })
    }

    case "turn_completed": {
      const failed = event.data.status === "failed"
      return messages.map((msg) => {
        if (msg.status !== "streaming") {
          return msg
        }
        return { ...msg, status: failed ? "error" : "completed" }
      })
    }

    case "model_call_recorded": {
      return [...messages]
    }

    case "turn_suspended": {
      return messages.map((msg) =>
        msg.status === "streaming" ? { ...msg, status: "completed" } : msg,
      )
    }

    case "turn_resumed": {
      return [...messages]
    }

    case "stream_error": {
      return messages.map((msg, index) => {
        if (index === messages.length - 1 && msg.status === "streaming") {
          return { ...msg, status: "error" }
        }
        return msg
      })
    }
  }
}

export function chatMessagesReducer(
  messages: readonly ChatMessage[],
  action: ChatMessageAction,
): ChatMessage[] {
  switch (action.type) {
    case "client_send": {
      return [
        ...messages,
        action.payload.userMessage,
        action.payload.agentMessage,
      ]
    }

    case "stream_stopped": {
      return messages.map((msg, index) => {
        if (index === messages.length - 1 && msg.status === "streaming") {
          return { ...msg, status: "completed" }
        }
        return msg
      })
    }

    case "agent_event":
      return reduceAgentEvent(messages, action.event)

    default: {
      const _exhaustive: never = action
      void _exhaustive
      return [...messages]
    }
  }
}
