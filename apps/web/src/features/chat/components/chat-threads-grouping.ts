import type { ChatThreadSummary } from "../types"

export interface ChatThreadGroup {
  readonly id: string
  readonly label: string
  readonly threads: readonly ChatThreadSummary[]
}

/**
 * Groups chat threads by their last activity date relative to a reference date.
 * Groups with zero items are omitted.
 */
export function groupChatThreads(
  threads: readonly ChatThreadSummary[],
  referenceDate: Date = new Date(),
): ChatThreadGroup[] {
  const startOfToday = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
  ).getTime()
  const oneDayMs = 24 * 60 * 60 * 1000
  const startOfYesterday = startOfToday - oneDayMs
  const startOfSevenDaysAgo = startOfToday - 6 * oneDayMs

  const today: ChatThreadSummary[] = []
  const yesterday: ChatThreadSummary[] = []
  const previousSevenDays: ChatThreadSummary[] = []
  const older: ChatThreadSummary[] = []

  for (const thread of threads) {
    const threadTime = new Date(thread.updatedAt).getTime()

    if (Number.isNaN(threadTime)) {
      older.push(thread)
      continue
    }

    if (threadTime >= startOfToday) {
      today.push(thread)
    } else if (threadTime >= startOfYesterday) {
      yesterday.push(thread)
    } else if (threadTime >= startOfSevenDaysAgo) {
      previousSevenDays.push(thread)
    } else {
      older.push(thread)
    }
  }

  const groups: ChatThreadGroup[] = []

  if (today.length > 0) {
    groups.push({ id: "today", label: "Today", threads: today })
  }
  if (yesterday.length > 0) {
    groups.push({ id: "yesterday", label: "Yesterday", threads: yesterday })
  }
  if (previousSevenDays.length > 0) {
    groups.push({
      id: "previous-7-days",
      label: "Previous 7 days",
      threads: previousSevenDays,
    })
  }
  if (older.length > 0) {
    groups.push({ id: "older", label: "Older", threads: older })
  }

  return groups
}
