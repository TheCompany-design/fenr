import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useCallback, useEffect, useRef } from "react"
import { ComposerMount, useComposerEvent } from "@/components/composer"
import { HeaderPortal } from "@/components/shell/header-portal"
import { getThreadChoiceFn } from "../chat.functions"
import { useComposerBridge, useComposerHostData } from "../composer-host"
import { useAgentStream } from "../hooks/use-agent-stream"
import { chatKeys, threadMessagesQueryOptions } from "../queries/chat-queries"
import { ApprovalPrompt } from "./approval-prompt"
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

export function ChatContainer({ threadId, onNavigate }: ChatContainerProps) {
  const queryClient = useQueryClient()
  const { send, stop, isStreaming, turn } = useAgentStream()
  const { savedProviders } = useComposerHostData()

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
      } catch {}
    },
    [onNavigate, routerNavigate],
  )

  const { data: messages } = useQuery(threadMessagesQueryOptions(threadId))
  const safeMessages = messages ?? []

  const { data: threadChoice } = useQuery({
    queryKey: ["chat", "thread-choice", threadId],
    queryFn: () =>
      getThreadChoiceFn({ data: { threadId: threadId as string } }),
    enabled: Boolean(threadId),
    staleTime: 1000 * 30,
    retry: 1,
  })

  const bridge = useComposerBridge({
    threadId,
    messages: safeMessages,
    threadChoice: threadChoice ?? null,
    savedProviders,
    turnUsage: turn.usage,
    turnStatus: turn.status,
    isStreaming,
    send,
    stop,
    onTurnStarted: (serverThreadId) =>
      safeNavigate({
        to: "/chat/$threadId",
        params: { threadId: serverThreadId },
        replace: true,
      }),
  })

  useComposerEvent("composer:open-provider-picker", () => {
    void safeNavigate({ to: "/settings/provider" })
  })

  const hasStarted = Boolean(threadId) || safeMessages.length > 0 || isStreaming

  const awaitingApproval =
    turn.status === "suspended" &&
    turn.turnId !== null &&
    turn.awaitingApprovalItemId !== null
      ? { turnId: turn.turnId, itemId: turn.awaitingApprovalItemId }
      : null

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-background">
      {}
      <HeaderPortal region="start" className="min-w-0 flex-1">
        <ChatHeaderTitle threadId={threadId} />
      </HeaderPortal>

      {}
      <div className="relative flex min-h-0 flex-1 w-full flex-col overflow-hidden">
        {}
        <ChatMessages messages={safeMessages} showEmptyState={false} />

        {}
        {awaitingApproval ? (
          <div className="pointer-events-auto absolute inset-x-0 bottom-28 z-20 px-4 sm:px-8">
            <ApprovalPrompt
              turnId={awaitingApproval.turnId}
              itemId={awaitingApproval.itemId}
              attempt={turn.approvalAttempt ?? 1}
            />
          </div>
        ) : null}

        {}
        <div
          data-slot="composer-container"
          className={`pointer-events-none absolute inset-x-0 z-10 flex flex-col transition-all duration-500 ease-out ${
            hasStarted
              ? "bottom-0 translate-y-0 justify-end bg-linear-to-t from-background via-background/80 to-transparent pb-4 pt-10 sm:pb-6"
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
              <ComposerMount bridge={bridge} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
