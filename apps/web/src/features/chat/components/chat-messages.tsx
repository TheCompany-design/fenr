import { AiChat02Icon, ArrowDown01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { MessageScroller } from "@workspace/ui/components/message-scroller"
import { useAtomValue } from "jotai"
import { useCallback, useRef, useState } from "react"
import { isStreamingAtom } from "../state/chat-atoms"
import { groupIntoTurns } from "../state/chat-turns"
import type { ChatMessage } from "../types"
import { ChatTurnBlock } from "./chat-turn-block"

export interface ChatMessagesProps {
  readonly messages: readonly ChatMessage[]
  readonly showEmptyState?: boolean
  readonly onContinue?: (prompt: string) => void
  readonly onInspectTurn?: (turnId: string) => void
  readonly navigation?: "rail"
  readonly busy?: boolean
  readonly followOutput?: boolean
}

export function ChatMessages({
  messages,
  showEmptyState = true,
  onContinue,
  onInspectTurn,
  navigation = "rail",
  busy,
  followOutput = true,
}: ChatMessagesProps) {
  const isStreaming = useAtomValue(isStreamingAtom)
  const isBusy = busy ?? isStreaming
  const viewportRef = useRef<HTMLElement>(null)
  const [showScrollBottom, setShowScrollBottom] = useState(false)

  const handleFollowChange = useCallback(
    (following: boolean) => {
      setShowScrollBottom(!following && messages.length > 0)
    },
    [messages.length],
  )

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = viewportRef.current
    if (el) {
      if (typeof el.scrollTo === "function") {
        el.scrollTo({
          top: el.scrollHeight,
          behavior,
        })
      } else {
        el.scrollTop = el.scrollHeight
      }
      setShowScrollBottom(false)
    }
  }, [])

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
      <MessageScroller
        viewportRef={viewportRef}
        followOutput={followOutput}
        followThreshold={56}
        busy={isBusy}
        navigation={navigation}
        onFollowChange={handleFollowChange}
        className="min-h-0 flex-1 w-full"
        viewportClassName="h-full w-full"
        contentClassName="mx-auto flex w-full max-w-4xl flex-col gap-2 p-4 pb-44 sm:pb-52"
      >
        {groupIntoTurns(messages).map((turn, index) => (
          <ChatTurnBlock
            key={turn.messages[0]?.id ?? index}
            turn={turn}
            onContinue={onContinue}
            onInspectTurn={onInspectTurn}
          />
        ))}
      </MessageScroller>

      {/* Floating scroll to bottom button */}
      {showScrollBottom && (
        <button
          type="button"
          aria-label="Scroll to latest messages"
          onClick={() => scrollToBottom("smooth")}
          className="absolute bottom-36 sm:bottom-40 right-6 sm:right-8 z-20 flex items-center gap-1.5 rounded-full border border-border bg-background/95 px-3 py-1.5 text-xs font-medium text-foreground shadow-md backdrop-blur-xs transition-all hover:bg-muted active:scale-95"
        >
          <HugeiconsIcon icon={ArrowDown01Icon} size={14} />
          <span>Scroll to bottom</span>
        </button>
      )}
    </div>
  )
}
