import { and, asc, db, eq, isNotNull, schema } from "@workspace/database"
import { moduleLogger } from "@/lib/logger"
import type { ModelCallProjection } from "../state/stream-reducer"
import type { ChatMessage } from "../types"

const log = moduleLogger("chat.server")

export function lastAgentMessageByTurn(
  items: readonly {
    readonly id: string
    readonly turnId: string
    readonly kind: string
  }[],
): Map<string, string> {
  const lastByTurn = new Map<string, string>()
  for (const item of items) {
    if (item.kind === "agent_message") lastByTurn.set(item.turnId, item.id)
  }
  return lastByTurn
}

export interface GetThreadMessagesOptions {
  readonly requestId?: string
}

export async function getThreadMessages(
  threadId: string,
  tenantId: string,
  options?: GetThreadMessagesOptions,
): Promise<ChatMessage[] | null> {
  log.debug(
    { threadId, tenantId, requestId: options?.requestId },
    "Fetching thread messages from database",
  )

  const [thread] = await db
    .select({ id: schema.agentThreads.id })
    .from(schema.agentThreads)
    .where(
      and(
        eq(schema.agentThreads.id, threadId),
        eq(schema.agentThreads.tenantId, tenantId),
      ),
    )
    .limit(1)

  if (!thread) {
    return null
  }

  const [items, modelCallRows] = await Promise.all([
    db
      .select({
        id: schema.agentItems.id,
        turnId: schema.agentItems.turnId,
        kind: schema.agentItems.kind,
        payload: schema.agentItems.payload,
        createdAt: schema.agentItems.createdAt,
      })
      .from(schema.agentItems)
      .where(
        and(
          eq(schema.agentItems.threadId, threadId),
          eq(schema.agentItems.tenantId, tenantId),
          isNotNull(schema.agentItems.completedAt),
        ),
      )
      .orderBy(asc(schema.agentItems.createdAt), asc(schema.agentItems.id)),
    db
      .select({
        callId: schema.agentModelCalls.id,
        turnId: schema.agentModelCalls.turnId,
        attempt: schema.agentModelCalls.attempt,
        step: schema.agentModelCalls.step,
        provider: schema.agentModelCalls.provider,
        model: schema.agentModelCalls.model,
        effort: schema.agentModelCalls.effort,
        inputTokens: schema.agentModelCalls.inputTokens,
        uncachedInputTokens: schema.agentModelCalls.uncachedInputTokens,
        outputTokens: schema.agentModelCalls.outputTokens,
        cachedInputTokens: schema.agentModelCalls.cachedInputTokens,
        cacheCreationInputTokens:
          schema.agentModelCalls.cacheCreationInputTokens,
        toolUseInputTokens: schema.agentModelCalls.toolUseInputTokens,
        reasoningTokens: schema.agentModelCalls.reasoningTokens,
        durationMs: schema.agentModelCalls.durationMs,
        ttftMs: schema.agentModelCalls.ttftMs,
        finishReason: schema.agentModelCalls.finishReason,
        errorCode: schema.agentModelCalls.errorCode,
        actorUserId: schema.agentModelCalls.userId,
      })
      .from(schema.agentModelCalls)
      .where(
        and(
          eq(schema.agentModelCalls.threadId, threadId),
          eq(schema.agentModelCalls.tenantId, tenantId),
        ),
      )
      .orderBy(
        asc(schema.agentModelCalls.startedAt),
        asc(schema.agentModelCalls.attempt),
        asc(schema.agentModelCalls.step),
        asc(schema.agentModelCalls.id),
      ),
  ])

  const callsByTurn = new Map<string, ModelCallProjection[]>()
  for (const row of modelCallRows) {
    const calls = callsByTurn.get(row.turnId) ?? []
    calls.push({
      callId: row.callId,
      status: row.errorCode === null ? "succeeded" : "failed",
      attempt: row.attempt,
      step: row.step,
      provider: row.provider,
      model: row.model,
      effort: row.effort,
      usage: {
        input_tokens: row.inputTokens,
        uncached_input_tokens: row.uncachedInputTokens,
        output_tokens: row.outputTokens,
        cached_input_tokens: row.cachedInputTokens,
        cache_creation_input_tokens: row.cacheCreationInputTokens,
        tool_use_input_tokens: row.toolUseInputTokens,
        reasoning_tokens: row.reasoningTokens,
      },
      durationMs: row.durationMs,
      ttftMs: row.ttftMs,
      finishReason: row.finishReason,
      errorCode: row.errorCode,
      actorUserId: row.actorUserId,
    })
    callsByTurn.set(row.turnId, calls)
  }

  const lastAgentItemByTurn = lastAgentMessageByTurn(items)

  return items
    .filter(
      (
        item,
      ): item is typeof item & { kind: "user_message" | "agent_message" } =>
        item.kind === "user_message" || item.kind === "agent_message",
    )
    .map((item): ChatMessage => {
      const payload = item.payload as Record<string, unknown> | null
      const isUser = item.kind === "user_message"

      return {
        id: item.id,
        turnId: item.turnId,
        role: isUser ? "user" : "agent",
        content: isUser
          ? typeof payload?.content === "string"
            ? payload.content
            : ""
          : typeof payload?.text === "string"
            ? payload.text
            : "",
        thinking:
          !isUser && typeof payload?.thinking === "string"
            ? payload.thinking
            : undefined,
        createdAt: item.createdAt.toISOString(),
        ...(!isUser &&
        lastAgentItemByTurn.get(item.turnId) === item.id &&
        (callsByTurn.get(item.turnId)?.length ?? 0) > 0
          ? { modelCalls: callsByTurn.get(item.turnId) }
          : {}),
      }
    })
}

export async function getThreadChoice(
  threadId: string,
  tenantId: string,
): Promise<{
  providerConfigId: string | null
  model: string | null
  effort: string | null
} | null> {
  const [thread] = await db
    .select({
      providerConfigId: schema.agentThreads.providerConfigId,
      model: schema.agentThreads.model,
      effort: schema.agentThreads.effort,
    })
    .from(schema.agentThreads)
    .where(
      and(
        eq(schema.agentThreads.id, threadId),
        eq(schema.agentThreads.tenantId, tenantId),
      ),
    )
    .limit(1)

  return thread
    ? {
        providerConfigId: thread.providerConfigId,
        model: thread.model,
        effort: thread.effort,
      }
    : null
}
