import { AiChat02Icon, Delete02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useAtom } from "jotai"
import { useCallback } from "react"
import { useAgentStream } from "../hooks/use-agent-stream"
import { chatKeys, threadMessagesQueryOptions } from "../queries/chat-queries"
import { activeChatThreadIdAtom } from "../state/chat-atoms"
import type { ChatMessage } from "../types"
import { ChatComposer } from "./chat-composer"
import { ChatMessages } from "./chat-messages"

export interface ChatContainerProps {
  readonly threadId?: string | null
  readonly onNavigate?: (opts: {
    to: string
    params?: Record<string, string>
  }) => void | Promise<void>
}

/**
 * Main conversational chat shell container orchestrating header controls,
 * scrollable message feed, active streaming turn projection, and input composer.
 * Decoupled from local useState and useEffect; state is driven by TanStack Router URL params,
 * Jotai transition atoms, and TanStack Query cache.
 */
export function ChatContainer({
  threadId = null,
  onNavigate,
}: ChatContainerProps) {
  const queryClient = useQueryClient()
  const [activeThreadId, setActiveThreadId] = useAtom(activeChatThreadIdAtom)
  const { projection, send, stop, reset, isStreaming } = useAgentStream()

  const routerNavigate = useNavigate()

  const safeNavigate = useCallback(
    async (opts: { to: string; params?: Record<string, string> }) => {
      if (onNavigate) {
        await onNavigate(opts)
        return
      }
      try {
        await routerNavigate(opts as never)
      } catch {
        // Fallback if router context is missing in testing
      }
    },
    [onNavigate, routerNavigate],
  )

  const effectiveThreadId = threadId ?? activeThreadId

  // Primary messages state sourced directly from TanStack Query cache
  const { data: messages = [] } = useQuery(
    threadMessagesQueryOptions(effectiveThreadId),
  )

  const handleSend = async (prompt: string) => {
    const targetThreadId = effectiveThreadId ?? crypto.randomUUID()
    setActiveThreadId(targetThreadId)

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: prompt,
      createdAt: new Date().toISOString(),
    }

    // Optimistically update the message feed in TanStack Query cache
    queryClient.setQueryData<ChatMessage[]>(
      chatKeys.messages(targetThreadId),
      (old = []) => [...old, userMsg],
    )

    // When on initial /chat route, transition URL state immediately to /chat/<uuid>
    if (!threadId) {
      await safeNavigate({
        to: "/_app/chat/$threadId",
        params: { threadId: targetThreadId },
      })
    }

    // Begin SSE streaming response
    await send(prompt, targetThreadId)
  }

  const handleClear = async () => {
    stop()
    reset()
    setActiveThreadId(null)
    await safeNavigate({ to: "/_app/chat" })
  }

  const hasStarted =
    Boolean(effectiveThreadId) ||
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

        {hasStarted && (
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
