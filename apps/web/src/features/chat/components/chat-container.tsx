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
    setActiveThreadId(null)
    setMessages([])
  }

  const hasStarted =
    messages.length > 0 ||
    isStreaming ||
    Boolean(projection.streamingText) ||
    Boolean(projection.streamingThinking)

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-background">
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

      {/* Conversational Canvas Area */}
      <div className="relative flex min-h-0 flex-1 w-full flex-col overflow-hidden">
        {/* Messages Feed (Scrolls behind floating composer) */}
        <ChatMessages
          messages={messages}
          projection={projection}
          isStreaming={isStreaming}
          showEmptyState={false}
        />

        {/* Floating / Centered Composer Layer */}
        <div
          data-slot="composer-container"
          className={`pointer-events-none absolute inset-x-0 z-10 flex flex-col transition-all duration-500 ease-out ${
            hasStarted
              ? "bottom-0 translate-y-0 justify-end bg-gradient-to-t from-background via-background/80 to-transparent pb-4 pt-10 sm:pb-6"
              : "bottom-1/2 translate-y-1/2 justify-center pb-0 pt-0"
          }`}
        >
          <div className="pointer-events-auto mx-auto flex w-full max-w-4xl flex-col items-center px-4 sm:px-8">
            {/* Hero Greeting (Centered above composer, smoothly collapses on start) */}
            <div
              data-slot="hero-greeting"
              className={`flex flex-col items-center text-center transition-all duration-500 ease-out ${
                hasStarted
                  ? "pointer-events-none mb-0 max-h-0 -translate-y-4 scale-95 opacity-0 overflow-hidden"
                  : "mb-6 max-h-96 translate-y-0 scale-100 opacity-100"
              }`}
            >
              <div className="flex size-12 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground shadow-xs">
                <HugeiconsIcon icon={AiChat02Icon} size={24} />
              </div>
              <h2 className="mt-4 text-base font-semibold tracking-tight text-foreground sm:text-lg">
                How can Nabu assist you today?
              </h2>
              <p className="mt-1.5 max-w-md text-xs leading-relaxed text-muted-foreground">
                Ask questions about financial reconciliations, ledger balance
                calculations, or trigger autonomous workflows with real-time
                streaming.
              </p>
            </div>

            {/* Message Composer */}
            <div className="w-full">
              <ChatComposer
                onSend={handleSend}
                onStop={stop}
                isStreaming={isStreaming}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
