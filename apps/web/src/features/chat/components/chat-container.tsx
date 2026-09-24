import { AiChat02Icon, Delete02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useEffect, useState } from "react"
import { useAgentStream } from "../hooks/use-agent-stream"
import { useChatStore } from "../state/chat-store"
import type { ChatMessage } from "../types"
import { ChatComposer } from "./chat-composer"
import { ChatMessages } from "./chat-messages"

export interface ChatContainerProps {
  readonly initialThreadId?: string | null
}

/**
 * Main conversational chat shell container orchestrating header controls,
 * scrollable message feed, active streaming turn projection, and input composer.
 */
export function ChatContainer({ initialThreadId = null }: ChatContainerProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const { projection, send, stop, reset, isStreaming } = useAgentStream()
  const activeThreadId = useChatStore((state) => state.activeThreadId)
  const setActiveThreadId = useChatStore((state) => state.setActiveThreadId)

  useEffect(() => {
    if (initialThreadId) {
      setActiveThreadId(initialThreadId)
    }
  }, [initialThreadId, setActiveThreadId])

  // When turn completes, commit streaming message to messages list
  useEffect(() => {
    if (projection.status === "completed" && projection.streamingText) {
      setMessages((prev) => [
        ...prev,
        {
          id:
            projection.activeItemId || projection.turnId || crypto.randomUUID(),
          role: "agent",
          content: projection.streamingText,
          thinking: projection.streamingThinking || null,
          createdAt: "Just now",
        },
      ])
      reset()
    }
  }, [
    projection.status,
    projection.streamingText,
    projection.streamingThinking,
    projection.activeItemId,
    projection.turnId,
    reset,
  ])

  const handleSend = async (prompt: string) => {
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: prompt,
      createdAt: "Just now",
    }
    setMessages((prev) => [...prev, userMsg])
    await send(prompt, activeThreadId)
  }

  const handleClear = () => {
    stop()
    reset()
    setMessages([])
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] w-full flex-col overflow-hidden bg-background">
      {/* Chat Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <HugeiconsIcon icon={AiChat02Icon} size={18} />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-foreground">
              Nabu Agent Chat
            </h1>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span
                className={`size-1.5 rounded-full ${
                  isStreaming ? "bg-amber-500 animate-pulse" : "bg-emerald-500"
                }`}
              />
              <span>{isStreaming ? "Streaming response..." : "Online"}</span>
            </div>
          </div>
        </div>

        {messages.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <HugeiconsIcon icon={Delete02Icon} size={14} />
            <span>Clear conversation</span>
          </button>
        )}
      </header>

      {/* Messages Feed */}
      <ChatMessages
        messages={messages}
        projection={projection}
        isStreaming={isStreaming}
      />

      {/* Bottom Composer */}
      <div className="shrink-0 p-4 sm:px-8 max-w-4xl w-full mx-auto">
        <ChatComposer
          onSend={handleSend}
          onStop={stop}
          isStreaming={isStreaming}
        />
      </div>
    </div>
  )
}
