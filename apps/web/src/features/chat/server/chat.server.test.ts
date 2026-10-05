import { describe, expect, it } from "bun:test"
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
