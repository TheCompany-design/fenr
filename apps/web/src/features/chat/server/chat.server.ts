import { and, asc, db, eq, isNotNull, schema } from "@workspace/database"
import { moduleLogger } from "@/lib/logger"
import type { ChatMessage } from "../types"

const log = moduleLogger("chat.server")

export interface GetThreadMessagesOptions {
  readonly requestId?: string
}

/**
 * Retrieve chronological chat messages for a specific thread, scoped to the tenant.
 * Enforces organization boundary isolation.
 */
export async function getThreadMessages(
  threadId: string,
  tenantId: string,
  options?: GetThreadMessagesOptions,
): Promise<ChatMessage[] | null> {
  log.debug(
    { threadId, tenantId, requestId: options?.requestId },
    "Fetching thread messages from database",
  )

  // 1. Verify thread exists and belongs to the active tenant
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

  // 2. Fetch items for this thread ordered chronologically
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
        isNotNull(schema.agentItems.completedAt),
      ),
    )
    .orderBy(asc(schema.agentItems.createdAt))

  // Only message kinds are bubbles. A tool call, a tool result and the two
  // halves of an approval are real transcript items with their own identity;
  // mapping them to a message produced a row of empty agent bubbles on every
  // reload, which is how a thread came to look like the agent had said nothing
  // five times.
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
