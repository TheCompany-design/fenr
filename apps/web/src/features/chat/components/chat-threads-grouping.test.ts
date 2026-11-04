import { describe, expect, it } from "bun:test"
import type { ChatThreadSummary } from "../types"
import { groupChatThreads } from "./chat-threads-grouping"

describe("groupChatThreads", () => {
  const reference = new Date(2026, 9, 28, 12, 0, 0) // Oct 28, 2026 12:00:00

  function makeThread(id: string, updatedAt: string): ChatThreadSummary {
    return {
      id,
      title: `Thread ${id}`,
      createdAt: updatedAt,
      updatedAt,
    }
  }

  it("returns empty array when thread list is empty", () => {
    expect(groupChatThreads([], reference)).toEqual([])
  })

  it("categorizes threads into Today, Yesterday, Previous 7 days, and Older", () => {
    const todayThread = makeThread("today", "2026-10-28T09:00:00.000Z")
    const yesterdayThread = makeThread("yesterday", "2026-10-27T15:00:00.000Z")
    const lastWeekThread = makeThread("last-week", "2026-10-24T12:00:00.000Z")
    const olderThread = makeThread("older", "2026-10-10T08:00:00.000Z")

    const groups = groupChatThreads(
      [todayThread, yesterdayThread, lastWeekThread, olderThread],
      reference,
    )

    expect(groups).toHaveLength(4)
    expect(groups[0]?.label).toBe("Today")
    expect(groups[0]?.threads).toEqual([todayThread])

    expect(groups[1]?.label).toBe("Yesterday")
    expect(groups[1]?.threads).toEqual([yesterdayThread])

    expect(groups[2]?.label).toBe("Previous 7 days")
    expect(groups[2]?.threads).toEqual([lastWeekThread])

    expect(groups[3]?.label).toBe("Older")
    expect(groups[3]?.threads).toEqual([olderThread])
  })

  it("omits empty groups when there are no threads matching that range", () => {
    const todayThread = makeThread("today", "2026-10-28T09:00:00.000Z")
    const olderThread = makeThread("older", "2026-09-01T00:00:00.000Z")

    const groups = groupChatThreads([todayThread, olderThread], reference)

    expect(groups).toHaveLength(2)
    expect(groups[0]?.label).toBe("Today")
    expect(groups[1]?.label).toBe("Older")
  })

  it("falls back to Older for invalid timestamps", () => {
    const invalidThread = makeThread("invalid", "not-a-date")
    const groups = groupChatThreads([invalidThread], reference)

    expect(groups).toHaveLength(1)
    expect(groups[0]?.label).toBe("Older")
    expect(groups[0]?.threads).toEqual([invalidThread])
  })
})
