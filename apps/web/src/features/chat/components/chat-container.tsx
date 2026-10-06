import { AiChat02Icon, Delete02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useCallback } from "react"
import { ProviderBanner } from "@/features/nabu/components/provider-notice"
import { useAgentStream } from "../hooks/use-agent-stream"
import { chatKeys, threadMessagesQueryOptions } from "../queries/chat-queries"
import { ApprovalPrompt } from "./approval-prompt"
import { ChatComposer } from "./chat-composer"
import { ChatMessages } from "./chat-messages"

export interface ChatContainerProps {
  readonly threadId?: string
  /**
   * Whether the viewer may change the workspace's model provider.
   *
   * Passed in rather than read here: the chat feature does not own membership, and
   * the route that renders it already has the answer.
   */
  readonly canAdministerProvider?: boolean
  readonly onNavigate?: (opts: {
    to: string
    params?: Record<string, string>
    replace?: boolean
  }) => void | Promise<void>
}

/**
 * Primary chat orchestrator component.
 * Sourced directly from TanStack Query's cache and route tree.
 * Coordinates smooth CSS transition from centered hero greeting to bottom-docked composer.
 */
export function ChatContainer({
  threadId,
  canAdministerProvider = false,
  onNavigate,
}: ChatContainerProps) {
  const queryClient = useQueryClient()
  const { send, stop, reset, isStreaming, turn } = useAgentStream()

  const routerNavigate = useNavigate()

  const safeNavigate = useCallback(
    async (opts: {
      to: string
      params?: Record<string, string>
      replace?: boolean
    }) => {
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

  // Authoritative messages state sourced directly from TanStack Query cache
  const { data: messages } = useQuery(threadMessagesQueryOptions(threadId))
  const safeMessages = messages ?? []

  const handleSend = async (prompt: string) => {
    await send(prompt, threadId, {
      onTurnStarted: async (serverThreadId) => {
        // Seamlessly transition URL from /chat to /chat/<server-thread-id>
        await safeNavigate({
          to: "/chat/$threadId",
          params: { threadId: serverThreadId },
          replace: true,
        })
      },
    })
  }

  const handleClear = async () => {
    stop()
    reset()
    queryClient.setQueryData(chatKeys.messages(threadId), [])
    queryClient.removeQueries({ queryKey: chatKeys.messages(null) })
    await safeNavigate({ to: "/chat" })
  }

  const hasStarted = Boolean(threadId) || safeMessages.length > 0 || isStreaming

  // A suspended turn is waiting on a decision, not on the model. Offering the
  // composer here would let a new turn start while this one is parked, and the
  // approval request would then belong to a conversation nobody is looking at.
  const awaitingApproval =
    turn.status === "suspended" &&
    turn.turnId !== null &&
    turn.awaitingApprovalItemId !== null
      ? { turnId: turn.turnId, itemId: turn.awaitingApprovalItemId }
      : null

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
                  isStreaming
                    ? "bg-amber-500 animate-pulse"
                    : awaitingApproval
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                }`}
              />
              <span>
                {isStreaming
                  ? "Streaming response..."
                  : awaitingApproval
                    ? "Waiting for your approval"
                    : "Online"}
              </span>
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
        <ChatMessages messages={safeMessages} showEmptyState={false} />

        {/* A parked turn needs a decision, not a spinner. */}
        {awaitingApproval ? (
          <div className="pointer-events-auto absolute inset-x-0 bottom-28 z-20 px-4 sm:px-8">
            <ApprovalPrompt
              turnId={awaitingApproval.turnId}
              itemId={awaitingApproval.itemId}
              attempt={turn.approvalAttempt ?? 1}
            />
          </div>
        ) : null}

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

            {/*
             * In the composer's own column, above the input — never an absolutely
             * positioned strip laid over it.
             *
             * That was the bug: the banner sat at `bottom-[4.75rem] z-20` with
             * pointer events on, which is *inside* the composer's own height, so
             * it swallowed every click and keystroke aimed at the textarea. A
             * supplementary status line must never be able to take the composer
             * down with it, and the only reliable way to guarantee that is for it
             * not to be positioned over the thing it decorates.
             */}
            <div className="w-full" data-slot="provider-banner">
              <ProviderBanner canAdminister={canAdministerProvider} />
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
