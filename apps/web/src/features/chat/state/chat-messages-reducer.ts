import type { AgentStreamEvent } from "@/lib/schemas/agent-stream"
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

/**
 * Pure reducer function that updates an array of ChatMessages based on
 * optimistic client dispatches and incoming SSE agent events.
 *
 * Guarantees a single, authoritative message list where streaming tokens
 * update the active assistant message in-place with zero duplicate bubbles.
 */
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
      // Find the last streaming message and mark it completed
      return messages.map((msg, index) => {
        if (index === messages.length - 1 && msg.status === "streaming") {
          return { ...msg, status: "completed" }
        }
        return msg
      })
    }

    case "agent_event": {
      const event = action.event
      switch (event.type) {
        case "turn_started": {
          return [...messages]
        }

        case "item_started": {
          const { item_id } = event.data
          // Update the id of the last streaming message to match server item_id
          const lastIdx = messages.length - 1
          if (lastIdx >= 0 && messages[lastIdx]?.status === "streaming") {
            const updated = [...messages]
            const current = messages[lastIdx]
            if (current) {
              updated[lastIdx] = { ...current, id: item_id }
            }
            return updated
          }
          return [...messages]
        }

        case "item_delta": {
          const { item_id, delta } = event.data
          const lastIdx = messages.length - 1
          if (lastIdx < 0) return [...messages]

          // Locate message by item_id or fallback to last streaming message
          const targetIdx = messages.findIndex((m) => m.id === item_id)
          const idxToUpdate =
            targetIdx !== -1
              ? targetIdx
              : messages[lastIdx]?.status === "streaming"
                ? lastIdx
                : -1

          if (idxToUpdate === -1) return [...messages]

          const target = messages[idxToUpdate]
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
          return messages.map((msg) => {
            if (msg.id === item_id) {
              if (payload.kind === "agent_message") {
                return {
                  ...msg,
                  content: payload.text || msg.content,
                  thinking:
                    payload.thinking !== undefined
                      ? payload.thinking
                      : msg.thinking,
                }
              }
              if (payload.kind === "user_message") {
                return {
                  ...msg,
                  content: payload.content || msg.content,
                }
              }
            }
            return msg
          })
        }

        case "turn_completed": {
          // Finalize any streaming messages to completed status
          return messages.map((msg) => {
            if (msg.status === "streaming") {
              return { ...msg, status: "completed" }
            }
            return msg
          })
        }

        case "stream_error": {
          // Mark active streaming message with error status
          return messages.map((msg, index) => {
            if (index === messages.length - 1 && msg.status === "streaming") {
              return { ...msg, status: "error" }
            }
            return msg
          })
        }

        default: {
          const _exhaustive: never = event
          void _exhaustive
          return [...messages]
        }
      }
    }

    default: {
      const _exhaustive: never = action
      void _exhaustive
      return [...messages]
    }
  }
}
