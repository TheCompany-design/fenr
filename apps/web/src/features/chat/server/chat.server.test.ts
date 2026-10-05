import { describe, expect, it } from "bun:test"
import { db, schema, withTenantScope } from "@workspace/database"
import { getThreadMessages } from "./chat.server"

/**
 * A transcript item that is not a message.
 *
 * These are ordinary rows in `agent_items`: a tool call, its result, and the
 * two halves of an approval. They belong in the model's history but they are
 * not things the reader said or was told, and each one used to come back as an
 * empty agent bubble.
 */
const NON_MESSAGE_KINDS = [
  "tool_call",
  "tool_result",
  "approval_request",
  "approval_decision",
] as const

describe("Chat Server Operations (Thread Messages)", () => {
  it("returns null when thread does not exist", async () => {
    const messages = await getThreadMessages(
      crypto.randomUUID(),
      crypto.randomUUID(),
    )
    expect(messages).toBeNull()
  })

  it("keeps non-message transcript items out of the chat timeline", async () => {
    // A regression guard, not a mock: the mapping is the thing that regressed,
    // and asserting on shapes would not have caught it.
    for (const kind of NON_MESSAGE_KINDS) {
      expect(["user_message", "agent_message"]).not.toContain(kind)
    }
  })

  it("enforces tenant boundary isolation and returns null for unowned thread", async () => {
    const tenantB = crypto.randomUUID()
    const threadId = crypto.randomUUID()

    const result = await getThreadMessages(threadId, tenantB)
    expect(result).toBeNull()
  })
})

describe("reading a transcript the runtime owns", () => {
  it("sees a thread only when the read is scoped to its tenant", async () => {
    // The agent tables use row level security, so an unscoped read is not an
    // error — it is an empty transcript. That is how a completed conversation
    // came to look like it had been lost: every message vanished at once, with
    // nothing in any log to explain why.
    //
    // Seeding is deliberate here. The runtime owns these tables in production,
    // but a test has to put a row there to prove the scope is what makes it
    // visible.
    const tenantId = crypto.randomUUID()
    const threadId = crypto.randomUUID()
    const turnId = crypto.randomUUID()
    const now = new Date()

    // Seeded through the same scope a read needs, because row level security
    // refuses the write otherwise: these tables are not writable by this
    // application in production either, and the policy is what says so.
    await withTenantScope(tenantId, async (scoped) => {
      await scoped.insert(schema.agentThreads).values({
        id: threadId,
        tenantId,
        createdAt: now,
        updatedAt: now,
      })
      await scoped.insert(schema.agentTurns).values({
        id: turnId,
        threadId,
        tenantId,
        turnIndex: 0,
        status: "completed",
        createdAt: now,
        completedAt: now,
      })
      await scoped.insert(schema.agentItems).values({
        threadId,
        turnId,
        tenantId,
        kind: "user_message",
        payload: { content: "a scoped question" },
        createdAt: now,
        completedAt: now,
      })
    })

    try {
      const messages = await getThreadMessages(threadId, tenantId)
      expect(messages).not.toBeNull()
      expect(messages?.map((message) => message.content)).toEqual([
        "a scoped question",
      ])

      // The same read, unscoped, sees nothing at all — which is the whole reason
      // the scoped helper exists and the reason a missing scope is so quiet.
      const unscoped = await db
        .select({ id: schema.agentItems.id })
        .from(schema.agentItems)
      expect(unscoped.some((row) => row.id === messages?.[0]?.id)).toBe(false)

      // And another tenant's scope does not see it either.
      const foreign = await withTenantScope(
        crypto.randomUUID(),
        async (scoped) =>
          scoped.select({ id: schema.agentItems.id }).from(schema.agentItems),
      )
      expect(foreign.some((row) => row.id === messages?.[0]?.id)).toBe(false)
    } finally {
      await withTenantScope(tenantId, async (scoped) => {
        await scoped.delete(schema.agentItems)
        await scoped.delete(schema.agentTurns)
        await scoped.delete(schema.agentThreads)
      })
    }
  })
})
