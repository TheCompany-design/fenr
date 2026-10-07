import { useQuery } from "@tanstack/react-query"
import { threadMessagesQueryOptions } from "../queries/chat-queries"
import { formatChatTitle } from "./format-chat-title"

/** What the screen is called before anyone has named the conversation. */
const UNTITLED = "New conversation"

/**
 * The chat's title in the app header, contributed through the header portal.
 *
 * Reads the same query the conversation itself renders, so it shares one cache
 * entry (no second request) and stays correct across the hop from a draft chat
 * to its persisted thread: the stream migrates the optimistic messages to the
 * thread's key before navigation, so the title does not blink on the way over.
 *
 * The transcript is selected down to the finished title rather than read whole.
 * Every streamed token rewrites the messages cache, and a component subscribed
 * to the array would re-render the header for each one of them, only to produce
 * the identical string.
 */
export function ChatHeaderTitle({ threadId }: { readonly threadId?: string }) {
  const { data: title } = useQuery({
    ...threadMessagesQueryOptions(threadId),
    select: formatChatTitle,
  })

  if (!title) {
    // A clean chat shows no title in the bar — but the page still needs a name.
    // An empty <h1> is worse than none (it lands in the document outline and in
    // landmark navigation as a title with no name), so the heading carries the
    // name for assistive technology only.
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
