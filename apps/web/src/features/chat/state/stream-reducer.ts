import {
  type AgentStreamEvent,
  type ItemDeltaPayload,
  parseAgentStreamEvent,
  type TurnStatus,
  type UsageReport,
} from "@/lib/schemas/agent-stream"

export interface ActiveTurnProjection {
  readonly threadId: string | null
  readonly turnId: string | null
  readonly activeItemId: string | null
  readonly streamingText: string
  readonly streamingThinking: string

  readonly streamingThinkingBlockId: string | null

  readonly streamingToolArguments: string

  readonly status:
    | "idle"
    | "in_progress"
    | "streaming"
    | "suspended"
    | "completed"
    | "failed"
    | "cancelled"
    | "error"

  readonly awaitingApprovalItemId: string | null
  readonly approvalAttempt: number | null

  readonly error: string | null

  readonly errorCode: string | null

  readonly usage: UsageReport | null
}

export const initialTurnProjection: ActiveTurnProjection = {
  threadId: null,
  turnId: null,
  activeItemId: null,
  streamingText: "",
  streamingThinking: "",
  streamingThinkingBlockId: null,
  streamingToolArguments: "",
  status: "idle",
  awaitingApprovalItemId: null,
  approvalAttempt: null,
  error: null,
  errorCode: null,
  usage: null,
}

export function isSettled(status: ActiveTurnProjection["status"]): boolean {
  return (
    status === "completed" ||
    status === "failed" ||
    status === "cancelled" ||
    status === "error"
  )
}

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

function applyDelta(
  state: ActiveTurnProjection,
  delta: ItemDeltaPayload,
): ActiveTurnProjection {
  switch (delta.kind) {
    case "text_delta":
      return { ...state, streamingText: state.streamingText + delta.text }
    case "thinking_delta":
      if (state.streamingThinkingBlockId !== delta.block_id) {
        return {
          ...state,
          streamingThinking: delta.text,
          streamingThinkingBlockId: delta.block_id,
        }
      }
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
        streamingThinkingBlockId: null,
        streamingToolArguments: "",

        activeItemId: null,
        status: "streaming",
        awaitingApprovalItemId: null,
        approvalAttempt: null,
        error: null,
        errorCode: null,
        usage: null,
      }

    case "turn_suspended":
      return {
        ...state,
        status: "suspended",
        awaitingApprovalItemId: event.data.item_id,
        approvalAttempt: event.data.attempt,
        activeItemId: null,
      }

    case "model_call_recorded": {
      return state
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

        awaitingApprovalItemId: null,
        approvalAttempt: null,
        activeItemId: null,
        usage: event.data.usage,
      }

    case "stream_error":
      return {
        ...state,
        status: "error",
        error: event.data.message,
        errorCode: event.data.code,
        awaitingApprovalItemId: null,
        approvalAttempt: null,
      }
  }
}

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
