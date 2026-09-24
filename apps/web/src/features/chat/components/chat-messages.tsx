import { AiChat02Icon, ArrowDown01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import { useCallback, useEffect, useRef, useState } from "react"
import type { ActiveTurnProjection, ChatMessage } from "../types"
import { ChatMessageItem } from "./chat-message-item"

export interface ChatMessagesProps {
  readonly messages: readonly ChatMessage[]
  readonly projection?: ActiveTurnProjection | null
  readonly isStreaming?: boolean
  readonly showEmptyState?: boolean
}

/**
 * Message feed using @workspace/ui/components/scroll-area.
 * Handles user scroll detection (stick-to-bottom), smooth auto-scroll on new messages,
 * non-fighting stream auto-scroll, and a floating "Scroll to bottom" button.
 */
export function ChatMessages({
  messages,
  projection,
  isStreaming = false,
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

  // When new messages arrive:
  // - If user sent a message, always snap to bottom
  // - If agent responded and user was at bottom, stay at bottom
  useEffect(() => {
    const countIncreased = messages.length > prevMessageCountRef.current
    prevMessageCountRef.current = messages.length

    if (!countIncreased) return

    const lastMessage = messages[messages.length - 1]
    const isFromUser = lastMessage?.role === "user"

    if (isFromUser) {
      isAtBottomRef.current = true
      scrollToBottom("smooth")
    } else if (isAtBottomRef.current) {
      scrollToBottom("smooth")
    }
  }, [messages, scrollToBottom])

  // While streaming tokens, only scroll if the user is already at the bottom
  // and has not intentionally scrolled up to read earlier messages.
  const streamingContent = `${projection?.streamingThinking ?? ""}${projection?.streamingText ?? ""}`
  useEffect(() => {
    if (
      isStreaming &&
      streamingContent &&
      isAtBottomRef.current &&
      viewportRef.current
    ) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight
    }
  }, [isStreaming, streamingContent])

  const hasMessages = messages.length > 0
  const hasActiveStreaming =
    Boolean(isStreaming) ||
    Boolean(projection?.streamingText) ||
    Boolean(projection?.streamingThinking)

  if (!hasMessages && !hasActiveStreaming) {
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
            <ChatMessageItem key={message.id} message={message} />
          ))}

          {hasActiveStreaming && projection && (
            <ChatMessageItem
              message={{
                id:
                  projection.activeItemId ||
                  projection.turnId ||
                  "active-stream-turn",
                role: "agent",
                content: projection.streamingText,
                thinking: projection.streamingThinking || null,
              }}
              isStreaming={isStreaming}
            />
          )}
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
