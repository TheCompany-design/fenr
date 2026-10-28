import { queryOptions } from "@tanstack/react-query"
import type { ThreadUsageResponse } from "@/lib/schemas/nabu"
import {
  getChatThreadsFn,
  getThreadMessagesFn,
  getThreadUsageFn,
} from "../chat.functions"
import type { ChatMessage, ChatThreadSummary } from "../types"

export const chatKeys = {
  all: ["chat"] as const,
  threads: () => [...chatKeys.all, "threads"] as const,
  thread: (threadId: string) => [...chatKeys.threads(), threadId] as const,
  messages: (threadId?: string | null) =>
    threadId
      ? ([...chatKeys.thread(threadId), "messages"] as const)
      : ([...chatKeys.all, "draft-messages"] as const),
  usage: (threadId?: string | null) =>
    threadId
      ? ([...chatKeys.thread(threadId), "usage"] as const)
      : ([...chatKeys.all, "draft-usage"] as const),
}

export function threadMessagesQueryOptions(threadId?: string | null) {
  return queryOptions<ChatMessage[] | null>({
    queryKey: chatKeys.messages(threadId),
    queryFn: async () => {
      if (!threadId) return []
      return getThreadMessagesFn({ data: { threadId } })
    },
    enabled: Boolean(threadId),
    staleTime: 10_000,
  })
}

export function threadUsageQueryOptions(threadId?: string | null) {
  return queryOptions<ThreadUsageResponse | null>({
    queryKey: chatKeys.usage(threadId),
    queryFn: async () => {
      if (!threadId) return null
      return getThreadUsageFn({ data: { threadId } })
    },
    enabled: Boolean(threadId),
    staleTime: 10_000,
  })
}

export function chatThreadsQueryOptions(limit?: number) {
  return queryOptions<ChatThreadSummary[]>({
    queryKey: chatKeys.threads(),
    queryFn: async () => {
      return getChatThreadsFn({ data: limit ? { limit } : undefined })
    },
    staleTime: 10_000,
  })
}
