import { describe, expect, it } from "bun:test"
import { db, eq, schema } from "@workspace/database"
import {
  deleteChatThread,
  getChatThreads,
  getThreadChoice,
  getThreadMessages,
  getThreadPendingApproval,
  lastAgentMessageByTurn,
} from "./chat.server"

async function seedOrganization(id: string) {
  await db.insert(schema.organization).values({
    id,
    name: `Test ${id}`,
    slug: `test-${id}`,
  })
}

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
  it("returns the model choice remembered for a thread", async () => {
    const tenantId = crypto.randomUUID()
    const threadId = crypto.randomUUID()
    await seedOrganization(tenantId)
    await db.insert(schema.agentThreads).values({
      id: threadId,
      tenantId,
      model: "openai/gpt-5.2",
      effort: "high",
    })

    try {
      expect(await getThreadChoice(threadId, tenantId)).toEqual({
        providerConfigId: null,
        model: "openai/gpt-5.2",
        effort: "high",
      })
      expect(await getThreadChoice(threadId, crypto.randomUUID())).toBeNull()
    } finally {
      await db
        .delete(schema.agentThreads)
        .where(eq(schema.agentThreads.id, threadId))
      await db
        .delete(schema.organization)
        .where(eq(schema.organization.id, tenantId))
    }
  })

  it("returns null when thread does not exist", async () => {
    const messages = await getThreadMessages(
      crypto.randomUUID(),
      crypto.randomUUID(),
    )
    expect(messages).toBeNull()
  })

  it("attaches a turn's model-call ledger to only its last assistant bubble", () => {
    const last = lastAgentMessageByTurn([
      { id: "user-1", turnId: "turn-1", kind: "user_message" },
      { id: "agent-1", turnId: "turn-1", kind: "agent_message" },
      { id: "tool-1", turnId: "turn-1", kind: "tool_call" },
      { id: "agent-2", turnId: "turn-1", kind: "agent_message" },
      { id: "agent-3", turnId: "turn-2", kind: "agent_message" },
    ])
    expect(last).toEqual(
      new Map([
        ["turn-1", "agent-2"],
        ["turn-2", "agent-3"],
      ]),
    )
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

  it("returns pending approval for a suspended turn scoped strictly to tenant", async () => {
    const tenantId = crypto.randomUUID()
    const foreignTenantId = crypto.randomUUID()
    const threadId = crypto.randomUUID()
    const turnId = crypto.randomUUID()
    const itemId = crypto.randomUUID()
    const now = new Date()

    await seedOrganization(tenantId)
    await seedOrganization(foreignTenantId)

    await db.transaction(async (scoped) => {
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
        status: "suspended",
        attempt: 1,
        createdAt: now,
      })
      await scoped.insert(schema.agentItems).values({
        id: itemId,
        threadId,
        turnId,
        tenantId,
        kind: "approval_request",
        payload: {
          kind: "approval_request",
          call_id: "call_1",
          tool: "composio-github_create_issue",
          arguments: { title: "Bug report" },
        },
        createdAt: now,
        completedAt: now,
      })
      await scoped.insert(schema.agentApprovals).values({
        itemId,
        tenantId,
        callId: "call_1",
        tool: "composio-github_create_issue",
        arguments: { title: "Bug report" },
        decision: null,
        requestedAt: now,
      })
    })

    try {
      const pending = await getThreadPendingApproval(threadId, tenantId)
      expect(pending).toEqual({
        turnId,
        itemId,
        attempt: 1,
      })

      // Foreign tenant cannot see the pending approval
      expect(
        await getThreadPendingApproval(threadId, foreignTenantId),
      ).toBeNull()

      // Once decided, pending approval returns null
      await db
        .update(schema.agentApprovals)
        .set({
          decision: "approved",
          decidedBy: crypto.randomUUID(),
          decidedAt: new Date(),
        })
        .where(eq(schema.agentApprovals.itemId, itemId))
      expect(await getThreadPendingApproval(threadId, tenantId)).toBeNull()
    } finally {
      await db.transaction(async (scoped) => {
        await scoped
          .delete(schema.agentApprovals)
          .where(eq(schema.agentApprovals.tenantId, tenantId))
        await scoped
          .delete(schema.agentItems)
          .where(eq(schema.agentItems.tenantId, tenantId))
        await scoped
          .delete(schema.agentTurns)
          .where(eq(schema.agentTurns.tenantId, tenantId))
        await scoped
          .delete(schema.agentThreads)
          .where(eq(schema.agentThreads.tenantId, tenantId))
        await scoped
          .delete(schema.organization)
          .where(eq(schema.organization.id, tenantId))
        await scoped
          .delete(schema.organization)
          .where(eq(schema.organization.id, foreignTenantId))
      })
    }
  })
})

describe("reading a transcript the runtime owns", () => {
  it("reads only items explicitly scoped to its tenant", async () => {
    // RLS is gone. Both the thread lookup and the item lookup must name the
    // tenant explicitly; an unscoped raw query is intentionally not isolated.
    const tenantId = crypto.randomUUID()
    const threadId = crypto.randomUUID()
    const turnId = crypto.randomUUID()
    const now = new Date()
    await seedOrganization(tenantId)

    // Seed directly in a transaction. The runtime owns these tables in
    // production, but tenant predicates are now ordinary SQL rather than RLS.
    await db.transaction(async (scoped) => {
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

      // A different tenant's explicit predicate does not see the item.
      const foreign = await db
        .select({ id: schema.agentItems.id })
        .from(schema.agentItems)
        .where(eq(schema.agentItems.tenantId, crypto.randomUUID()))
      expect(foreign.some((row) => row.id === messages?.[0]?.id)).toBe(false)
    } finally {
      await db.transaction(async (scoped) => {
        await scoped
          .delete(schema.agentItems)
          .where(eq(schema.agentItems.tenantId, tenantId))
        await scoped
          .delete(schema.agentTurns)
          .where(eq(schema.agentTurns.tenantId, tenantId))
        await scoped
          .delete(schema.agentThreads)
          .where(eq(schema.agentThreads.tenantId, tenantId))
        await scoped
          .delete(schema.organization)
          .where(eq(schema.organization.id, tenantId))
      })
    }
  })
})

describe("transcript order", () => {
  /**
   * A uuidv7-shaped identifier that increases with issue order.
   *
   * The runtime mints uuidv7, and the ordering below depends on that. A random
   * uuid carries no order, so a test built from one would be asserting nothing.
   */
  const orderedId = (n: number) =>
    `018f0000-0000-7000-8000-${n.toString(16).padStart(12, "0")}`

  it("puts the question before the answer when they share a timestamp", async () => {
    // A turn opens by inserting the user's message and a placeholder assistant
    // item in one transaction, and PostgreSQL's now() is the transaction start
    // time — so both rows carry the same timestamp. Sorting on that alone has no
    // answer, and physical row order drifts from issue order, which is how the
    // transcript came to show the reply above the question that prompted it.
    const tenantId = crypto.randomUUID()
    const threadId = crypto.randomUUID()
    const turnId = crypto.randomUUID()
    const instant = new Date()
    await seedOrganization(tenantId)

    await db.transaction(async (scoped) => {
      await scoped.insert(schema.agentThreads).values({
        id: threadId,
        tenantId,
        createdAt: instant,
        updatedAt: instant,
      })
      await scoped.insert(schema.agentTurns).values({
        id: turnId,
        threadId,
        tenantId,
        turnIndex: 0,
        status: "completed",
        createdAt: instant,
        completedAt: instant,
      })

      // Written in the wrong order on purpose. Physical row order is not the
      // order rows were issued in, so only the identifiers record it.
      await scoped.insert(schema.agentItems).values({
        id: orderedId(9),
        threadId,
        turnId,
        tenantId,
        kind: "agent_message",
        payload: { text: "the answer" },
        createdAt: instant,
        completedAt: instant,
      })
      await scoped.insert(schema.agentItems).values({
        id: orderedId(1),
        threadId,
        turnId,
        tenantId,
        kind: "user_message",
        payload: { content: "the question" },
        createdAt: instant,
        completedAt: instant,
      })
    })

    try {
      const messages = await getThreadMessages(threadId, tenantId)
      expect(messages?.map((message) => message.content)).toEqual([
        "the question",
        "the answer",
      ])
    } finally {
      await db.transaction(async (scoped) => {
        await scoped
          .delete(schema.agentItems)
          .where(eq(schema.agentItems.tenantId, tenantId))
        await scoped
          .delete(schema.agentTurns)
          .where(eq(schema.agentTurns.tenantId, tenantId))
        await scoped
          .delete(schema.agentThreads)
          .where(eq(schema.agentThreads.tenantId, tenantId))
        await scoped
          .delete(schema.organization)
          .where(eq(schema.organization.id, tenantId))
      })
    }
  })
})

describe("getChatThreads and deleteChatThread", () => {
  it("lists threads ordered by updatedAt desc and scoped strictly to tenant", async () => {
    const tenantA = crypto.randomUUID()
    const tenantB = crypto.randomUUID()
    const threadA1 = crypto.randomUUID()
    const threadA2 = crypto.randomUUID()
    const threadB = crypto.randomUUID()

    await seedOrganization(tenantA)
    await seedOrganization(tenantB)

    const t1 = new Date(Date.now() - 60_000)
    const t2 = new Date(Date.now())

    try {
      await db.insert(schema.agentThreads).values([
        {
          id: threadA1,
          tenantId: tenantA,
          title: "First conversation",
          model: "openai/gpt-5.2",
          effort: "low",
          createdAt: t1,
          updatedAt: t1,
        },
        {
          id: threadA2,
          tenantId: tenantA,
          title: "Second conversation",
          model: "anthropic/claude-3-7-sonnet",
          effort: "high",
          createdAt: t2,
          updatedAt: t2,
        },
        {
          id: threadB,
          tenantId: tenantB,
          title: "Other tenant conversation",
          model: "google/gemini-2.5-flash",
          createdAt: t2,
          updatedAt: t2,
        },
      ])

      const threadsA = await getChatThreads(tenantA)
      expect(threadsA).toHaveLength(2)
      // Most recently updated first
      expect(threadsA[0]?.id).toBe(threadA2)
      expect(threadsA[0]?.title).toBe("Second conversation")
      expect(threadsA[0]?.model).toBe("anthropic/claude-3-7-sonnet")
      expect(threadsA[1]?.id).toBe(threadA1)
      expect(threadsA[1]?.title).toBe("First conversation")

      // Limit works
      const limited = await getChatThreads(tenantA, 1)
      expect(limited).toHaveLength(1)
      expect(limited[0]?.id).toBe(threadA2)

      // Tenant B sees only its own
      const threadsB = await getChatThreads(tenantB)
      expect(threadsB).toHaveLength(1)
      expect(threadsB[0]?.id).toBe(threadB)
    } finally {
      await db
        .delete(schema.agentThreads)
        .where(eq(schema.agentThreads.tenantId, tenantA))
      await db
        .delete(schema.agentThreads)
        .where(eq(schema.agentThreads.tenantId, tenantB))
      await db
        .delete(schema.organization)
        .where(eq(schema.organization.id, tenantA))
      await db
        .delete(schema.organization)
        .where(eq(schema.organization.id, tenantB))
    }
  })

  it("derives and backfills a fallback title from the first user message when agent_threads.title is null", async () => {
    const tenantId = crypto.randomUUID()
    const threadId = crypto.randomUUID()
    const turnId = crypto.randomUUID()
    const now = new Date()

    await seedOrganization(tenantId)

    try {
      await db.transaction(async (scoped) => {
        await scoped.insert(schema.agentThreads).values({
          id: threadId,
          tenantId,
          title: null,
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
          payload: {
            kind: "user_message",
            content: "Audit our Q3 cloud infrastructure spend",
          },
          createdAt: now,
          completedAt: now,
        })
      })

      const threads = await getChatThreads(tenantId)
      expect(threads).toHaveLength(1)
      expect(threads[0]?.id).toBe(threadId)
      expect(threads[0]?.title).toBe("Audit our Q3 cloud infrastructure spend")

      const [persisted] = await db
        .select({ title: schema.agentThreads.title })
        .from(schema.agentThreads)
        .where(eq(schema.agentThreads.id, threadId))
      expect(persisted?.title).toBe("Audit our Q3 cloud infrastructure spend")
    } finally {
      await db.transaction(async (scoped) => {
        await scoped
          .delete(schema.agentItems)
          .where(eq(schema.agentItems.tenantId, tenantId))
        await scoped
          .delete(schema.agentTurns)
          .where(eq(schema.agentTurns.tenantId, tenantId))
        await scoped
          .delete(schema.agentThreads)
          .where(eq(schema.agentThreads.tenantId, tenantId))
        await scoped
          .delete(schema.organization)
          .where(eq(schema.organization.id, tenantId))
      })
    }
  })

  it("deletes a thread within tenant bounds and prevents cross-tenant deletion", async () => {
    const tenantA = crypto.randomUUID()
    const tenantB = crypto.randomUUID()
    const threadA = crypto.randomUUID()

    await seedOrganization(tenantA)
    await seedOrganization(tenantB)

    try {
      await db.insert(schema.agentThreads).values({
        id: threadA,
        tenantId: tenantA,
        title: "Thread to delete",
      })

      // Tenant B attempting to delete Tenant A's thread fails safely
      const deletedByB = await deleteChatThread(threadA, tenantB)
      expect(deletedByB).toBe(false)

      // Verify thread is still intact
      const threadsBefore = await getChatThreads(tenantA)
      expect(threadsBefore).toHaveLength(1)

      // Tenant A deleting their own thread succeeds
      const deletedByA = await deleteChatThread(threadA, tenantA)
      expect(deletedByA).toBe(true)

      // Verify thread is gone
      const threadsAfter = await getChatThreads(tenantA)
      expect(threadsAfter).toHaveLength(0)

      // Deleting again returns false
      expect(await deleteChatThread(threadA, tenantA)).toBe(false)
    } finally {
      await db
        .delete(schema.agentThreads)
        .where(eq(schema.agentThreads.tenantId, tenantA))
      await db
        .delete(schema.organization)
        .where(eq(schema.organization.id, tenantA))
      await db
        .delete(schema.organization)
        .where(eq(schema.organization.id, tenantB))
    }
  })
})
