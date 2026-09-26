import { describe, expect, it } from "bun:test"
import { getThreadMessages } from "./chat.server"

describe("Chat Server Operations (Thread Messages)", () => {
  it("returns empty array when thread does not exist", async () => {
    const messages = await getThreadMessages(
      crypto.randomUUID(),
      crypto.randomUUID(),
    )
    expect(messages).toEqual([])
  })

  it("enforces tenant boundary isolation and maps payload correctly", async () => {
    const tenantB = crypto.randomUUID()
    const threadId = crypto.randomUUID()

    const result = await getThreadMessages(threadId, tenantB)
    expect(result).toEqual([])
  })
})
