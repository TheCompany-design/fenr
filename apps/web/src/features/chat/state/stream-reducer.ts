import {
  type AgentStreamEvent,
  type ItemDeltaPayload,
  parseAgentStreamEvent,
  type TurnStatus,
  type UsageReport,
} from "@/lib/schemas/agent-stream"

type ModelCallUsage = Extract<
  AgentStreamEvent,
  { type: "model_call_recorded" }
>["data"]["usage"]

export interface ModelCallProjection {
  readonly callId: string | null
  readonly status: "succeeded" | "failed"
  readonly attempt: number
  readonly step: number
  readonly provider: string
  readonly model: string
  readonly effort: string | null
  readonly usage: ModelCallUsage
  readonly durationMs: number | null
  readonly ttftMs: number | null
  readonly finishReason: string | null
  readonly errorCode: string | null
  readonly actorUserId?: string | null
}

export interface LiveTurnTelemetry {
  readonly inputTokens: number
  readonly uncachedInputTokens: number
  readonly cachedInputTokens: number
  readonly cacheCreationInputTokens: number
  readonly outputTokens: number
  readonly reasoningTokens: number
  readonly totalTokens: number
  readonly cacheHitRate: number | null
  readonly lastStepPromptTokens: number
  readonly lastStepCompletionTokens: number
}

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
  readonly modelCalls: readonly ModelCallProjection[]
  readonly liveTelemetry: LiveTurnTelemetry | null
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
  modelCalls: [],
  liveTelemetry: null,
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
        modelCalls: [],
        liveTelemetry: null,
      }

    case "turn_suspended":
      return {
        ...state,
        threadId: event.data.thread_id,
        turnId: event.data.turn_id,
        status: "suspended",
        awaitingApprovalItemId: event.data.item_id,
        approvalAttempt: event.data.attempt,
        activeItemId: null,
      }

    case "model_call_recorded": {
      const call: ModelCallProjection = {
        callId: null,
        status: event.data.error_code === null ? "succeeded" : "failed",
        attempt: event.data.attempt,
        step: event.data.step,
        provider: event.data.provider,
        model: event.data.model,
        effort: event.data.effort ?? null,
        usage: event.data.usage,
        durationMs: event.data.duration_ms,
        ttftMs: event.data.ttft_ms,
        finishReason: event.data.finish_reason,
        errorCode: event.data.error_code,
      }
      const modelCalls = [
        ...state.modelCalls.filter(
          (existing) =>
            existing.attempt !== call.attempt || existing.step !== call.step,
        ),
        call,
      ].sort(
        (left, right) => left.attempt - right.attempt || left.step - right.step,
      )
      const totals = modelCalls.reduce(
        (sum, recorded) => ({
          inputTokens: sum.inputTokens + recorded.usage.input_tokens,
          uncachedInputTokens:
            sum.uncachedInputTokens +
            (recorded.usage.uncached_input_tokens ??
              recorded.usage.input_tokens),
          cachedInputTokens:
            sum.cachedInputTokens + recorded.usage.cached_input_tokens,
          cacheCreationInputTokens:
            sum.cacheCreationInputTokens +
            recorded.usage.cache_creation_input_tokens,
          outputTokens: sum.outputTokens + recorded.usage.output_tokens,
          reasoningTokens:
            sum.reasoningTokens + recorded.usage.reasoning_tokens,
          totalTokens:
            sum.totalTokens +
            recorded.usage.input_tokens +
            recorded.usage.output_tokens,
        }),
        {
          inputTokens: 0,
          uncachedInputTokens: 0,
          cachedInputTokens: 0,
          cacheCreationInputTokens: 0,
          outputTokens: 0,
          reasoningTokens: 0,
          totalTokens: 0,
        },
      )
      const lastCall = modelCalls.at(-1)
      return {
        ...state,
        modelCalls,
        liveTelemetry: {
          ...totals,
          cacheHitRate:
            totals.inputTokens > 0
              ? totals.cachedInputTokens / totals.inputTokens
              : null,
          lastStepPromptTokens: lastCall?.usage.input_tokens ?? 0,
          lastStepCompletionTokens: lastCall?.usage.output_tokens ?? 0,
        },
      }
    }

    case "turn_resumed":
      return {
        ...state,
        threadId: event.data.thread_id,
        turnId: event.data.turn_id,
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
