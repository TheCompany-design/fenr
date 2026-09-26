import { AiChat02Icon, ArrowDown01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import { useCallback, useEffect, useRef, useState } from "react"
import type { ChatMessage } from "../types"
import { ChatMessageItem } from "./chat-message-item"

export interface ChatMessagesProps {
  readonly messages: readonly ChatMessage[]
  readonly showEmptyState?: boolean
}

/**
 * Message feed using @workspace/ui/components/scroll-area.
 * Renders the authoritative message list in a single render loop with
 * intelligent stick-to-bottom auto-scrolling and floating scroll button.
 */
export function ChatMessages({
  messages,
  showEmptyState = true,
}: ChatMessagesProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const isAtBottomRef = useRef(true)
  const [showScrollBottom, setShowScrollBottom] = useState(false)
  const prevMessageCountRef = useRef(messages.length)

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget
    const threshold = 80
    const distanceFromBottom =
      target.scrollHeight - target.scrollTop - target.clientHeight
    const atBottom = distanceFromBottom <= threshold
    isAtBottomRef.current = atBottom
    setShowScrollBottom(!atBottom && messages.length > 0)
  }

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = viewportRef.current
    if (el) {
      if (behavior === "instant" || behavior === "auto") {
        el.scrollTop = el.scrollHeight
      } else {
        el.scrollTo({
          top: el.scrollHeight,
          behavior: "smooth",
        })
      }
      isAtBottomRef.current = true
      setShowScrollBottom(false)
    }
  }, [])

  // Auto-scroll mechanics:
  // - If user sent a message, smoothly snap to bottom
  // - If agent is streaming or appended and user is at bottom, stick to bottom
  const lastMessage = messages[messages.length - 1]
  const lastContentLength =
    (lastMessage?.content.length ?? 0) + (lastMessage?.thinking?.length ?? 0)

  useEffect(() => {
    if (!lastMessage) return

    const countIncreased = messages.length > prevMessageCountRef.current
    prevMessageCountRef.current = messages.length

    if (countIncreased && lastMessage.role === "user") {
      isAtBottomRef.current = true
      scrollToBottom("smooth")
    } else if (
      isAtBottomRef.current &&
      viewportRef.current &&
      lastContentLength > 0
    ) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight
    }
  }, [messages.length, lastContentLength, lastMessage, scrollToBottom])

  if (messages.length === 0) {
    if (!showEmptyState) {
      return <div className="min-h-0 flex-1 w-full" />
    }

    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center p-8 pb-32 text-center">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground">
          <HugeiconsIcon icon={AiChat02Icon} size={24} />
        </div>
        <h3 className="mt-4 text-sm font-semibold text-foreground">
          How can Nabu assist you today?
        </h3>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">
          Ask questions about financial reconciliations, ledger balance
          calculations, or trigger autonomous workflows with real-time
          streaming.
        </p>
      </div>
    )
  }

  return (
    <div className="relative flex min-h-0 flex-1 w-full flex-col overflow-hidden">
      <ScrollArea
        viewportRef={viewportRef}
        onScroll={handleScroll}
        className="min-h-0 flex-1 w-full"
      >
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-2 p-4 pb-44 sm:pb-52">
          {messages.map((message) => (
            <ChatMessageItem
              key={message.id}
              message={message}
              isStreaming={message.status === "streaming"}
            />
          ))}
        </div>
      </ScrollArea>

      {/* Floating scroll to bottom button when scrolled up */}
      {showScrollBottom && (
        <button
          type="button"
          aria-label="Scroll to latest messages"
          onClick={() => scrollToBottom("smooth")}
          className="absolute bottom-36 sm:bottom-40 right-6 z-20 flex items-center gap-1.5 rounded-full border border-border bg-background/95 px-3 py-1.5 text-xs font-medium text-foreground shadow-md backdrop-blur-xs transition-all hover:bg-muted active:scale-95"
        >
          <HugeiconsIcon icon={ArrowDown01Icon} size={14} />
          <span>Scroll to bottom</span>
        </button>
      )}
    </div>
  )
}
