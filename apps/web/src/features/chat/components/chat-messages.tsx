import { AiChat02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import { useEffect, useRef } from "react"
import type { ActiveTurnProjection, ChatMessage } from "../types"
import { ChatMessageItem } from "./chat-message-item"

export interface ChatMessagesProps {
  readonly messages: readonly ChatMessage[]
  readonly projection?: ActiveTurnProjection | null
  readonly isStreaming?: boolean
}

/**
 * Message feed using @workspace/ui/components/scroll-area.
 * Handles auto-scrolling to bottom on stream deltas and empty-state presentation.
 */
export function ChatMessages({
  messages,
  projection,
  isStreaming = false,
}: ChatMessagesProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll when new messages arrive or streaming text updates
  useEffect(() => {
    if (
      messages.length >= 0 ||
      projection?.streamingText !== undefined ||
      projection?.streamingThinking !== undefined
    ) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [
    messages.length,
    projection?.streamingText,
    projection?.streamingThinking,
  ])

  const hasMessages = messages.length > 0
  const hasActiveStreaming =
    Boolean(isStreaming) ||
    Boolean(projection?.streamingText) ||
    Boolean(projection?.streamingThinking)

  if (!hasMessages && !hasActiveStreaming) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
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
    <ScrollArea className="flex-1 w-full">
      <div className="flex flex-col gap-2 p-4">
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

        <div ref={bottomRef} className="h-px" />
      </div>
    </ScrollArea>
  )
}
