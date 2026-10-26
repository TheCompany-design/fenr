import { and, asc, db, eq, isNotNull, schema } from "@workspace/database"
import { moduleLogger } from "@/lib/logger"
import type { ChatMessage } from "../types"

const log = moduleLogger("chat.server")

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

  const items = await db
    .select({
      id: schema.agentItems.id,
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

    .orderBy(asc(schema.agentItems.createdAt), asc(schema.agentItems.id))

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
