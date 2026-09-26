import { queryOptions } from "@tanstack/react-query"
import { getThreadMessagesFn } from "../chat.functions"
import type { ChatMessage } from "../types"

export const chatKeys = {
  all: ["chat"] as const,
  threads: () => [...chatKeys.all, "threads"] as const,
  thread: (threadId: string) => [...chatKeys.threads(), threadId] as const,
  messages: (threadId: string) =>
    [...chatKeys.thread(threadId), "messages"] as const,
}

export function threadMessagesQueryOptions(threadId?: string | null) {
  return queryOptions<ChatMessage[] | null>({
    queryKey: threadId
      ? chatKeys.messages(threadId)
      : ([...chatKeys.all, "empty-messages"] as const),
    queryFn: async () => {
      if (!threadId) return []
      return getThreadMessagesFn({ data: { threadId } })
    },
    enabled: Boolean(threadId),
    staleTime: 10_000,
  })
}
