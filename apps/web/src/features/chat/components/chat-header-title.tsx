import { useQuery } from "@tanstack/react-query"
import {
  chatThreadsQueryOptions,
  threadMessagesQueryOptions,
} from "../queries/chat-queries"
import { formatChatTitle } from "./format-chat-title"

const UNTITLED = "New conversation"

export function ChatHeaderTitle({ threadId }: { readonly threadId?: string }) {
  const { data: threadTitle } = useQuery({
    ...chatThreadsQueryOptions(),
    enabled: false,
    select: (threads) =>
      threadId
        ? (threads.find((thread) => thread.id === threadId)?.title?.trim() ??
          "")
        : "",
  })

  const { data: fallbackTitle } = useQuery({
    ...threadMessagesQueryOptions(threadId),
    select: formatChatTitle,
  })

  const title = threadTitle || fallbackTitle || ""

  if (!title) {
    return <h1 className="sr-only">{UNTITLED}</h1>
  }

  return (
    <h1
      className="truncate text-sm font-semibold tracking-tight text-foreground"
      title={title}
    >
      {title}
    </h1>
  )
}
