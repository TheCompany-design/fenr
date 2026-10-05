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

/**
 * Apply one agent event to the message timeline.
 *
 * Tool and approval items are transcript records with their own identity: they
 * never own a bubble, so they are ignored here rather than folded into a
 * message. That distinction is the difference between a tool call appearing in
 * the transcript and the assistant bubble being renamed out from under the
 * deltas still arriving for it.
 */
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
      // Only a message item owns a bubble. Tool calls and approval records
      // are transcript entries with their own identity, and adopting their
      // id here would rename the assistant bubble that is mid-stream — so
      // every later delta for that bubble would land on the wrong message.
      if (!isMessageItemKind(kind)) {
        return [...messages]
      }

      const lastIdx = messages.length - 1
      const current = messages[lastIdx]
      if (lastIdx >= 0 && current?.status === "streaming") {
        const updated = [...messages]
        updated[lastIdx] = { ...current, id: item_id }
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

      // Tool arguments stream against a tool item, which has no bubble.
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
      // Tool and approval completions are transcript records. They carry no
      // bubble, so there is nothing here to update.
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
      // Finalize any streaming messages. A failed turn is surfaced as an
      // error on the message it stopped on; a cancelled one keeps what it
      // produced, because the user asked for it to stop rather than for it
      // to have gone wrong.
      const failed = event.data.status === "failed"
      return messages.map((msg) => {
        if (msg.status !== "streaming") {
          return msg
        }
        return { ...msg, status: failed ? "error" : "completed" }
      })
    }

    case "turn_suspended": {
      // The turn is parked on a decision. Settle the bubble so the timeline
      // stops presenting it as live, and leave the wording to the approval
      // affordance rather than dressing it as a failure.
      return messages.map((msg) =>
        msg.status === "streaming" ? { ...msg, status: "completed" } : msg,
      )
    }

    case "turn_resumed": {
      // The next assistant item starts its own bubble; nothing to change on
      // the messages that were already settled.
      return [...messages]
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
  }
}

/**
 * Pure reducer function that updates an array of ChatMessages based on
 * optimistic client dispatches and incoming SSE agent events.
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

    case "agent_event":
      return reduceAgentEvent(messages, action.event)

    default: {
      const _exhaustive: never = action
      void _exhaustive
      return [...messages]
    }
  }
}
