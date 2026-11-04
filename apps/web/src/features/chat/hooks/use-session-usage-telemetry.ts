import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"
import type { UsageCostBreakdown } from "@/lib/schemas/nabu"
import { threadUsageQueryOptions } from "../queries/chat-queries"
import type { ActiveTurnProjection } from "../state/stream-reducer"
import type { ChatMessage } from "../types"

export interface SessionModelSummary {
  readonly provider: string
  readonly model: string
  readonly effort: string | null
  readonly calls: number
  readonly inputTokens: number
  readonly uncachedInputTokens: number
  readonly cachedInputTokens: number
  readonly outputTokens: number
  readonly reasoningTokens: number
  readonly costUsd: number
  readonly cacheHitRate: number | null
}

export interface UnifiedCallRecord {
  readonly callId: string
  readonly turnId: string
  readonly step: number
  readonly attempt: number
  readonly provider: string
  readonly model: string
  readonly effort: string | null
  readonly status: "succeeded" | "failed"
  readonly inputTokens: number
  readonly uncachedInputTokens: number
  readonly cachedInputTokens: number
  readonly cacheCreationInputTokens: number
  readonly toolUseInputTokens: number
  readonly outputTokens: number
  readonly reasoningTokens: number
  readonly durationMs: number | null
  readonly ttftMs: number | null
  readonly finishReason: string | null
  readonly errorCode: string | null
  readonly estimatedPromptTokens: number | null
  readonly messagesDropped: number | null
  readonly costBreakdown: UsageCostBreakdown | null
}

export interface TurnLedgerEntry {
  readonly turnId: string
  readonly turnIndex: number
  readonly isStreaming: boolean
  readonly calls: readonly UnifiedCallRecord[]
  readonly totalInputTokens: number
  readonly totalOutputTokens: number
  readonly totalCostUsd: number
  readonly cacheHitRate: number | null
}

export interface SessionUsageTelemetry {
  readonly totalInputTokens: number
  readonly uncachedInputTokens: number
  readonly cachedInputTokens: number
  readonly cacheCreationInputTokens: number
  readonly toolUseInputTokens: number
  readonly outputTokens: number
  readonly reasoningTokens: number
  readonly totalTokens: number
  readonly cacheHitRate: number | null
  readonly totalCostUsd: number
  readonly cacheSavingsUsd: number
  readonly unpricedCalls: number
  readonly costBreakdown: UsageCostBreakdown
  readonly modelsUsed: readonly SessionModelSummary[]
  readonly turnLedger: readonly TurnLedgerEntry[]
  readonly contextPressure: {
    readonly lastStepPromptTokens: number
    readonly lastStepCompletionTokens: number
    readonly lastTotalOccupancy: number
    readonly messagesDropped: number
    readonly truncatedCalls: number
  }
  readonly isStreaming: boolean
}

interface UseSessionUsageTelemetryOptions {
  readonly threadId?: string | null
  readonly messages?: readonly ChatMessage[]
  readonly activeTurn?: ActiveTurnProjection | null
  readonly isStreaming?: boolean
}

export function useSessionUsageTelemetry({
  threadId,
  messages = [],
  activeTurn,
  isStreaming = false,
}: UseSessionUsageTelemetryOptions): SessionUsageTelemetry {
  const { data: serverUsage } = useQuery(threadUsageQueryOptions(threadId))

  return useMemo(() => {
    // 1. Gather all calls from all sources, keyed by unique ID to deduplicate.
    // Sources:
    // a) serverUsage.calls (from GET /api/v1/threads/{id}/usage)
    // b) messages.modelCalls (from historical transcript payload)
    // c) activeTurn.modelCalls (from live SSE model_call_recorded events)
    const callsMap = new Map<string, UnifiedCallRecord>()

    // Add server usage calls
    if (serverUsage?.calls) {
      for (const call of serverUsage.calls) {
        const id =
          call.call_id || `${call.turn_id}:${call.step}:${call.attempt}`
        callsMap.set(id, {
          callId: call.call_id,
          turnId: call.turn_id,
          step: call.step,
          attempt: call.attempt,
          provider: call.provider,
          model: call.model,
          effort: call.effort ?? null,
          status: call.error_code ? "failed" : "succeeded",
          inputTokens: call.tokens.input_tokens,
          uncachedInputTokens: call.tokens.uncached_input_tokens,
          cachedInputTokens: call.tokens.cached_input_tokens,
          cacheCreationInputTokens: call.tokens.cache_creation_input_tokens,
          toolUseInputTokens: call.tokens.tool_use_input_tokens,
          outputTokens: call.tokens.output_tokens,
          reasoningTokens: call.tokens.reasoning_tokens,
          durationMs: call.duration_ms ?? null,
          ttftMs: call.ttft_ms ?? null,
          finishReason: call.finish_reason ?? null,
          errorCode: call.error_code ?? null,
          estimatedPromptTokens: call.estimated_prompt_tokens ?? null,
          messagesDropped: call.messages_dropped ?? null,
          costBreakdown: call.cost_breakdown ?? null,
        })
      }
    }

    // Merge from messages.modelCalls if not present from server
    for (const msg of messages) {
      if (!msg.modelCalls) continue
      for (const call of msg.modelCalls) {
        const id =
          call.callId ||
          (call.step !== undefined ? `msg:${call.step}:${call.attempt}` : null)
        if (!id || callsMap.has(id)) continue
        callsMap.set(id, {
          callId: call.callId ?? id,
          turnId: msg.turnId ?? "historical",
          step: call.step,
          attempt: call.attempt,
          provider: call.provider,
          model: call.model,
          effort: call.effort ?? null,
          status: call.status,
          inputTokens: call.usage.input_tokens,
          uncachedInputTokens: call.usage.uncached_input_tokens ?? 0,
          cachedInputTokens: call.usage.cached_input_tokens ?? 0,
          cacheCreationInputTokens: call.usage.cache_creation_input_tokens ?? 0,
          toolUseInputTokens: call.usage.tool_use_input_tokens ?? 0,
          outputTokens: call.usage.output_tokens,
          reasoningTokens: call.usage.reasoning_tokens ?? 0,
          durationMs: call.durationMs ?? null,
          ttftMs: call.ttftMs ?? null,
          finishReason: call.finishReason ?? null,
          errorCode: call.errorCode ?? null,
          estimatedPromptTokens: null,
          messagesDropped: null,
          costBreakdown: null,
        })
      }
    }

    // Merge from active in-flight turn
    if (activeTurn?.modelCalls && activeTurn.modelCalls.length > 0) {
      for (const call of activeTurn.modelCalls) {
        const turnId = activeTurn.turnId ?? "in-flight"
        const id = call.callId || `live:${turnId}:${call.step}:${call.attempt}`
        callsMap.set(id, {
          callId: call.callId ?? id,
          turnId,
          step: call.step,
          attempt: call.attempt,
          provider: call.provider,
          model: call.model,
          effort: call.effort ?? null,
          status: call.status,
          inputTokens: call.usage.input_tokens,
          uncachedInputTokens: call.usage.uncached_input_tokens ?? 0,
          cachedInputTokens: call.usage.cached_input_tokens ?? 0,
          cacheCreationInputTokens: call.usage.cache_creation_input_tokens ?? 0,
          toolUseInputTokens: call.usage.tool_use_input_tokens ?? 0,
          outputTokens: call.usage.output_tokens,
          reasoningTokens: call.usage.reasoning_tokens ?? 0,
          durationMs: call.durationMs ?? null,
          ttftMs: call.ttftMs ?? null,
          finishReason: call.finishReason ?? null,
          errorCode: call.errorCode ?? null,
          estimatedPromptTokens: null,
          messagesDropped: null,
          costBreakdown: null,
        })
      }
    }

    const allCalls = Array.from(callsMap.values())

    let totalInputTokens = 0
    let uncachedInputTokens = 0
    let cachedInputTokens = 0
    let cacheCreationInputTokens = 0
    let toolUseInputTokens = 0
    let outputTokens = 0
    let reasoningTokens = 0
    let unpricedCalls = 0
    let messagesDroppedTotal = 0
    let truncatedCallsTotal = 0

    const costBreakdown: UsageCostBreakdown = {
      uncached_input_usd: 0,
      tool_use_input_usd: 0,
      cache_read_usd: 0,
      cache_creation_usd: 0,
      output_usd: 0,
      reasoning_usd: 0,
      total_usd: 0,
      cache_savings_usd: 0,
    }

    // Models aggregation map
    const modelsMap = new Map<
      string,
      {
        provider: string
        model: string
        effort: string | null
        calls: number
        inputTokens: number
        uncachedInputTokens: number
        cachedInputTokens: number
        outputTokens: number
        reasoningTokens: number
        costUsd: number
      }
    >()

    // Turn ledger map
    const turnMap = new Map<string, UnifiedCallRecord[]>()

    for (const call of allCalls) {
      totalInputTokens += call.inputTokens
      uncachedInputTokens += call.uncachedInputTokens
      cachedInputTokens += call.cachedInputTokens
      cacheCreationInputTokens += call.cacheCreationInputTokens
      toolUseInputTokens += call.toolUseInputTokens
      outputTokens += call.outputTokens
      reasoningTokens += call.reasoningTokens

      if (call.messagesDropped && call.messagesDropped > 0) {
        messagesDroppedTotal += call.messagesDropped
        truncatedCallsTotal += 1
      }

      if (call.costBreakdown) {
        costBreakdown.uncached_input_usd +=
          call.costBreakdown.uncached_input_usd
        costBreakdown.tool_use_input_usd +=
          call.costBreakdown.tool_use_input_usd
        costBreakdown.cache_read_usd += call.costBreakdown.cache_read_usd
        costBreakdown.cache_creation_usd +=
          call.costBreakdown.cache_creation_usd
        costBreakdown.output_usd += call.costBreakdown.output_usd
        costBreakdown.reasoning_usd += call.costBreakdown.reasoning_usd
        costBreakdown.total_usd += call.costBreakdown.total_usd
        costBreakdown.cache_savings_usd += call.costBreakdown.cache_savings_usd
      } else {
        unpricedCalls += 1
      }

      const modelKey = `${call.provider}:${call.model}:${call.effort ?? ""}`
      const existingModel = modelsMap.get(modelKey) ?? {
        provider: call.provider,
        model: call.model,
        effort: call.effort,
        calls: 0,
        inputTokens: 0,
        uncachedInputTokens: 0,
        cachedInputTokens: 0,
        outputTokens: 0,
        reasoningTokens: 0,
        costUsd: 0,
      }
      existingModel.calls += 1
      existingModel.inputTokens += call.inputTokens
      existingModel.uncachedInputTokens += call.uncachedInputTokens
      existingModel.cachedInputTokens += call.cachedInputTokens
      existingModel.outputTokens += call.outputTokens
      existingModel.reasoningTokens += call.reasoningTokens
      if (call.costBreakdown) {
        existingModel.costUsd += call.costBreakdown.total_usd
      }
      modelsMap.set(modelKey, existingModel)

      const turnCalls = turnMap.get(call.turnId) ?? []
      turnCalls.push(call)
      turnMap.set(call.turnId, turnCalls)
    }

    // Overwrite totals with server-side totals if server totals are available and complete
    if (serverUsage?.totals && allCalls.length <= serverUsage.calls.length) {
      totalInputTokens = serverUsage.totals.input_tokens
      uncachedInputTokens = serverUsage.totals.uncached_input_tokens
      cachedInputTokens = serverUsage.totals.cached_input_tokens
      cacheCreationInputTokens = serverUsage.totals.cache_creation_input_tokens
      toolUseInputTokens = serverUsage.totals.tool_use_input_tokens
      outputTokens = serverUsage.totals.output_tokens
      reasoningTokens = serverUsage.totals.reasoning_tokens
      unpricedCalls = serverUsage.totals.unpriced_calls

      if (serverUsage.totals.cost_breakdown) {
        Object.assign(costBreakdown, serverUsage.totals.cost_breakdown)
      }
    }

    const totalTokens = totalInputTokens + outputTokens
    const cacheHitRate =
      totalInputTokens > 0 ? cachedInputTokens / totalInputTokens : null

    const modelsUsed: SessionModelSummary[] = Array.from(
      modelsMap.values(),
    ).map((m) => ({
      ...m,
      cacheHitRate:
        m.inputTokens > 0 ? m.cachedInputTokens / m.inputTokens : null,
    }))

    // Sort turn ledger by first call's step or appearance
    let turnIndexCounter = 1
    const turnLedger: TurnLedgerEntry[] = Array.from(turnMap.entries()).map(
      ([turnId, calls]) => {
        const sortedCalls = [...calls].sort(
          (a, b) => a.step - b.step || a.attempt - b.attempt,
        )
        const tIn = sortedCalls.reduce((acc, c) => acc + c.inputTokens, 0)
        const tOut = sortedCalls.reduce((acc, c) => acc + c.outputTokens, 0)
        const tCached = sortedCalls.reduce(
          (acc, c) => acc + c.cachedInputTokens,
          0,
        )
        const tCost = sortedCalls.reduce(
          (acc, c) => acc + (c.costBreakdown?.total_usd ?? 0),
          0,
        )
        return {
          turnId,
          turnIndex: turnIndexCounter++,
          isStreaming: isStreaming && turnId === activeTurn?.turnId,
          calls: sortedCalls,
          totalInputTokens: tIn,
          totalOutputTokens: tOut,
          totalCostUsd: tCost,
          cacheHitRate: tIn > 0 ? tCached / tIn : null,
        }
      },
    )

    // Context pressure footprint
    const lastCall = allCalls.at(-1)
    const lastStepPrompt =
      activeTurn?.liveTelemetry?.lastStepPromptTokens ??
      lastCall?.inputTokens ??
      0
    const lastStepCompletion =
      activeTurn?.liveTelemetry?.lastStepCompletionTokens ??
      lastCall?.outputTokens ??
      0

    return {
      totalInputTokens,
      uncachedInputTokens,
      cachedInputTokens,
      cacheCreationInputTokens,
      toolUseInputTokens,
      outputTokens,
      reasoningTokens,
      totalTokens,
      cacheHitRate,
      totalCostUsd: costBreakdown.total_usd,
      cacheSavingsUsd: costBreakdown.cache_savings_usd,
      unpricedCalls,
      costBreakdown,
      modelsUsed,
      turnLedger,
      contextPressure: {
        lastStepPromptTokens: lastStepPrompt,
        lastStepCompletionTokens: lastStepCompletion,
        lastTotalOccupancy: lastStepPrompt + lastStepCompletion,
        messagesDropped: messagesDroppedTotal,
        truncatedCalls: truncatedCallsTotal,
      },
      isStreaming,
    }
  }, [serverUsage, messages, activeTurn, isStreaming])
}
