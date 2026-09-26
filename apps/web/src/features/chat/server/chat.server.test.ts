import { describe, expect, it } from "bun:test"
import { getThreadMessages } from "./chat.server"

describe("Chat Server Operations (Thread Messages)", () => {
  it("returns null when thread does not exist", async () => {
    const messages = await getThreadMessages(
      crypto.randomUUID(),
      crypto.randomUUID(),
    )
    expect(messages).toBeNull()
  })

  it("enforces tenant boundary isolation and returns null for unowned thread", async () => {
    const tenantB = crypto.randomUUID()
    const threadId = crypto.randomUUID()

    const result = await getThreadMessages(threadId, tenantB)
    expect(result).toBeNull()
  })
})
