import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useCallback, useEffect, useRef } from "react"
import { HeaderPortal } from "@/components/shell/header-portal"
import { useAgentStream } from "../hooks/use-agent-stream"
import { chatKeys, threadMessagesQueryOptions } from "../queries/chat-queries"
import { ApprovalPrompt } from "./approval-prompt"
import { ChatComposer } from "./chat-composer"
import { ChatHeaderTitle } from "./chat-header-title"
import { ChatMessages } from "./chat-messages"

export interface ChatContainerProps {
  readonly threadId?: string
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
 *
 * The screen has no header of its own: the app shell's top bar owns that, and
 * the chat contributes its title to it through the header portal. What is left
 * here is the conversation itself.
 */
export function ChatContainer({ threadId, onNavigate }: ChatContainerProps) {
  const queryClient = useQueryClient()
  const { send, stop, isStreaming, turn } = useAgentStream()

  /*
   * A chat with no thread is a clean chat.
   *
   * A failed or abandoned turn leaves its messages in the draft key, and the
   * failure path deliberately keeps them so the person can read what went
   * wrong. Without this, clicking Chat in the sidebar to start over reopened
   * that dead conversation — and, now that the header names a chat from its
   * first prompt, reopened its title in the top bar too.
   *
   * Once per mount, and never while a turn is streaming: this runs on entry, not
   * on every change of the streaming flag. A failed send flips that flag back to
   * false within milliseconds, so a re-run here would delete the failed
   * conversation the moment it appeared.
   */
  const clearedDraftRef = useRef(false)
  useEffect(() => {
    if (clearedDraftRef.current || threadId || isStreaming) {
      return
    }
    clearedDraftRef.current = true
    queryClient.removeQueries({ queryKey: chatKeys.messages(null) })
  }, [isStreaming, queryClient, threadId])

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
      {/* This screen's contribution to the app shell's header. */}
      <HeaderPortal region="start" className="min-w-0 flex-1">
        <ChatHeaderTitle threadId={threadId} />
      </HeaderPortal>

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
                  : "mb-4 max-h-96 translate-y-0 scale-100 opacity-100"
              }`}
            >
              {/*
               * A greeting line and a question, nothing else. No logo, no badge,
               * no paragraph explaining the product: the composer beneath it
               * already shows what this screen is for, and a card of icons above
               * a prompt box is decoration pretending to be an affordance.
               */}
              <p className="text-sm text-muted-foreground">Hi, I’m Nabu 👋</p>
              <h2 className="mt-2 text-balance text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                What are we working on today?
              </h2>
            </div>

            {/* Message Composer */}
            <div className="w-full">
              <ChatComposer
                onSend={handleSend}
                onStop={stop}
                isStreaming={isStreaming}
                showSuggestions={!hasStarted}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
