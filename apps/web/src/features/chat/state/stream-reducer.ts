import {
  type AgentStreamEvent,
  type ItemDeltaPayload,
  parseAgentStreamEvent,
  type TurnStatus,
} from "@/lib/schemas/agent-stream"

export interface ActiveTurnProjection {
  readonly threadId: string | null
  readonly turnId: string | null
  readonly activeItemId: string | null
  readonly streamingText: string
  readonly streamingThinking: string
  /** Tool-call arguments seen so far, before they parse as JSON. */
  readonly streamingToolArguments: string
  /**
   * Mirrors the server's `TurnStatus` rather than collapsing it.
   *
   * `suspended` is the reason this matters: it is not terminal, and folding it
   * into "error" or "completed" would tell the UI a turn had settled while it is
   * in fact waiting on a person.
   */
  readonly status:
    | "idle"
    | "in_progress"
    | "streaming"
    | "suspended"
    | "completed"
    | "failed"
    | "cancelled"
    | "error"
  /** The approval item a suspended turn is waiting on, when it is waiting. */
  readonly awaitingApprovalItemId: string | null
  readonly approvalAttempt: number | null
  readonly error: string | null
}

export const initialTurnProjection: ActiveTurnProjection = {
  threadId: null,
  turnId: null,
  activeItemId: null,
  streamingText: "",
  streamingThinking: "",
  streamingToolArguments: "",
  status: "idle",
  awaitingApprovalItemId: null,
  approvalAttempt: null,
  error: null,
}

/** Whether the turn has settled, one way or another. */
export function isSettled(status: ActiveTurnProjection["status"]): boolean {
  return (
    status === "completed" ||
    status === "failed" ||
    status === "cancelled" ||
    status === "error"
  )
}

/**
 * The stream status a server turn status implies.
 *
 * `in_progress` maps to `streaming` because that is what the client is doing
 * with it; the server's name describes the turn, not the connection.
 */
function projectionStatus(status: TurnStatus): ActiveTurnProjection["status"] {
  switch (status) {
    case "in_progress":
      return "streaming"
    case "completed":
      return "completed"
    case "failed":
      return "failed"
    case "suspended":
      return "suspended"
    case "cancelled":
      return "cancelled"
  }
}

/**
 * Fold a delta into the projection.
 *
 * The three deltas accumulate into different fields on purpose: reasoning is
 * shown apart from the answer, and tool arguments are not part of either — they
 * are a fragment of JSON that only means something once the runtime has
 * buffered the whole call.
 */
function applyDelta(
  state: ActiveTurnProjection,
  delta: ItemDeltaPayload,
): ActiveTurnProjection {
  switch (delta.kind) {
    case "text_delta":
      return { ...state, streamingText: state.streamingText + delta.text }
    case "thinking_delta":
      return {
        ...state,
        streamingThinking: state.streamingThinking + delta.text,
      }
    case "tool_arguments_delta":
      return {
        ...state,
        streamingToolArguments: state.streamingToolArguments + delta.text,
      }
  }
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
        streamingToolArguments: "",
        // Cleared rather than carried over: an active item belongs to the turn
        // that created it, and keeping the old id would make the next delta
        // land on the previous turn's message.
        activeItemId: null,
        status: "streaming",
        awaitingApprovalItemId: null,
        approvalAttempt: null,
        error: null,
      }

    case "turn_suspended":
      // Not an error and not a finish: the turn is parked on a decision, and
      // the item it is waiting on is what the UI has to offer the user.
      return {
        ...state,
        status: "suspended",
        awaitingApprovalItemId: event.data.item_id,
        approvalAttempt: event.data.attempt,
        activeItemId: null,
      }

    case "turn_resumed":
      return {
        ...state,
        status: "streaming",
        awaitingApprovalItemId: null,
        approvalAttempt: null,
        activeItemId: null,
      }

    case "item_started":
      return {
        ...state,
        activeItemId: event.data.item_id,
        streamingToolArguments: "",
      }

    case "item_delta":
      return applyDelta(state, event.data.delta)

    case "item_completed":
      return state

    case "turn_completed":
      return {
        ...state,
        status: projectionStatus(event.data.status),
        // A completed turn cannot still be waiting for approval; keeping the id
        // would leave a dead decision prompt on screen.
        awaitingApprovalItemId: null,
        approvalAttempt: null,
        activeItemId: null,
      }

    case "stream_error":
      return {
        ...state,
        status: "error",
        error: event.data.message,
        awaitingApprovalItemId: null,
        approvalAttempt: null,
      }
  }
}

/**
 * Apply a raw frame from the wire.
 *
 * A frame this client cannot model is reported and ignored rather than thrown:
 * the server adds capability as new event types precisely so an older client
 * keeps working, and dropping the stream would turn a forward-compatible design
 * into a hard failure.
 */
export function applyStreamFrame(
  state: ActiveTurnProjection,
  raw: unknown,
  onUnparseable?: (detail: { error: string; received: unknown }) => void,
): ActiveTurnProjection {
  const parsed = parseAgentStreamEvent(raw)
  if (!parsed.ok) {
    onUnparseable?.({ error: parsed.error, received: raw })
    return state
  }
  return streamReducer(state, parsed.event)
}
