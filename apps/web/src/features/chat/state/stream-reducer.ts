import type { AgentStreamEvent } from "@/lib/schemas/agent-stream"

export interface ActiveTurnProjection {
  readonly threadId: string | null
  readonly turnId: string | null
  readonly activeItemId: string | null
  readonly streamingText: string
  readonly streamingThinking: string
  readonly status: "idle" | "streaming" | "completed" | "error"
  readonly error: string | null
}

export const initialTurnProjection: ActiveTurnProjection = {
  threadId: null,
  turnId: null,
  activeItemId: null,
  streamingText: "",
  streamingThinking: "",
  status: "idle",
  error: null,
}

/**
 * Pure stream reducer that accumulates in-flight SSE events into a reactive
 * turn projection without React batching hazards or tearing.
 */
export function streamReducer(
  state: ActiveTurnProjection,
  event: AgentStreamEvent,
): ActiveTurnProjection {
  switch (event.type) {
    case "turn_started":
      return {
        ...state,
        threadId: event.data.thread_id,
        turnId: event.data.turn_id,
        streamingText: "",
        streamingThinking: "",
        status: "streaming",
        error: null,
      }

    case "item_started":
      return {
        ...state,
        activeItemId: event.data.item_id,
      }

    case "item_delta": {
      if (event.data.delta.kind === "text_delta") {
        return {
          ...state,
          streamingText: state.streamingText + event.data.delta.text,
        }
      }
      if (event.data.delta.kind === "thinking_delta") {
        return {
          ...state,
          streamingThinking: state.streamingThinking + event.data.delta.text,
        }
      }
      return state
    }

    case "item_completed":
      return state

    case "turn_completed":
      return {
        ...state,
        status: "completed",
      }

    case "stream_error":
      return {
        ...state,
        status: "error",
        error: event.data.message,
      }

    default: {
      const _exhaustive: never = event
      void _exhaustive
      return state
    }
  }
}
