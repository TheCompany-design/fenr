import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import type { ApprovalCardAnswers } from "@workspace/ui/components/approval-card"
import { useCallback, useEffect, useRef, useState } from "react"
import { ComposerMount, useComposerEvent } from "@/components/composer"
import { HeaderPortal } from "@/components/shell/header-portal"
import { getThreadChoiceFn } from "../chat.functions"
import { useComposerBridge, useComposerHostData } from "../composer-host"
import { useAgentStream } from "../hooks/use-agent-stream"
import {
  chatKeys,
  threadMessagesQueryOptions,
  threadPendingApprovalQueryOptions,
} from "../queries/chat-queries"
import { ApprovalPrompt } from "./approval-prompt"
import { ChatHeaderTitle } from "./chat-header-title"
import { ChatMessages } from "./chat-messages"
import {
  SessionStatsSheet,
  SessionStatsSheetTrigger,
} from "./session-stats-sheet"

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
  const { send, resume, stop, isStreaming, turn } = useAgentStream()
  const { savedProviders } = useComposerHostData()
  const [statsSheetOpen, setStatsSheetOpen] = useState(false)
  const [selectedTurnId, setSelectedTurnId] = useState<string | null>(null)

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

  const { data: persistedPendingApproval } = useQuery(
    threadPendingApprovalQueryOptions(threadId),
  )

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
    liveTelemetry: turn.liveTelemetry,
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

  const handleGenUiContinue = useCallback(
    (prompt: string) => {
      void send(prompt, threadId, {
        providerConfigId: threadChoice?.providerConfigId,
        modelId: threadChoice?.model,
        effort: threadChoice?.effort,
        onTurnStarted: (serverThreadId) =>
          safeNavigate({
            to: "/chat/$threadId",
            params: { threadId: serverThreadId },
            replace: true,
          }),
      })
    },
    [
      safeNavigate,
      send,
      threadChoice?.effort,
      threadChoice?.model,
      threadChoice?.providerConfigId,
      threadId,
    ],
  )

  const handleResumeTurn = useCallback(
    async (resumedTurnId: string, resumedThreadId?: string) => {
      await resume(resumedTurnId, resumedThreadId ?? threadId)
    },
    [resume, threadId],
  )

  const handleRequestChanges = useCallback(
    async (feedback: string) => {
      const trimmed = feedback.trim()
      if (!trimmed) return
      await send(
        `Please revise the previous tool action with the following changes:\n${trimmed}`,
        threadId,
        {
          providerConfigId: threadChoice?.providerConfigId,
          modelId: threadChoice?.model,
          effort: threadChoice?.effort,
        },
      )
    },
    [
      send,
      threadChoice?.effort,
      threadChoice?.model,
      threadChoice?.providerConfigId,
      threadId,
    ],
  )

  const handleSubmitQuestions = useCallback(
    async (answers: ApprovalCardAnswers) => {
      const formatted = Object.entries(answers)
        .map(([key, answer]) => {
          const parts = [
            ...answer.selected,
            ...(answer.custom?.trim() ? [answer.custom.trim()] : []),
          ]
          return parts.length > 0 ? `- ${key}: ${parts.join(", ")}` : null
        })
        .filter((line): line is string => line !== null)
        .join("\n")
      if (!formatted) return
      await send(`Here are my answers:\n${formatted}`, threadId, {
        providerConfigId: threadChoice?.providerConfigId,
        modelId: threadChoice?.model,
        effort: threadChoice?.effort,
      })
    },
    [
      send,
      threadChoice?.effort,
      threadChoice?.model,
      threadChoice?.providerConfigId,
      threadId,
    ],
  )

  const hasStarted = Boolean(threadId) || safeMessages.length > 0 || isStreaming

  const liveApproval =
    turn.status === "suspended" &&
    turn.turnId !== null &&
    turn.awaitingApprovalItemId !== null &&
    (!threadId || !turn.threadId || turn.threadId === threadId)
      ? {
          turnId: turn.turnId,
          itemId: turn.awaitingApprovalItemId,
          attempt: turn.approvalAttempt ?? 1,
        }
      : null

  const awaitingApproval =
    liveApproval ?? (!isStreaming ? (persistedPendingApproval ?? null) : null)

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-background">
      {}
      <HeaderPortal region="start" className="min-w-0 flex-1">
        <ChatHeaderTitle threadId={threadId} />
      </HeaderPortal>

      <HeaderPortal region="end" className="flex items-center gap-2">
        <SessionStatsSheetTrigger
          threadId={threadId}
          messages={safeMessages}
          activeTurn={turn}
          isStreaming={isStreaming}
          onOpen={() => {
            setSelectedTurnId(null)
            setStatsSheetOpen(true)
          }}
        />
      </HeaderPortal>

      {}
      <div className="relative flex min-h-0 flex-1 w-full flex-col overflow-hidden">
        {}
        <ChatMessages
          messages={safeMessages}
          showEmptyState={false}
          onContinue={handleGenUiContinue}
          onInspectTurn={(inspectedTurnId) => {
            setSelectedTurnId(inspectedTurnId)
            setStatsSheetOpen(true)
          }}
        />

        {}
        {awaitingApproval ? (
          <div className="pointer-events-auto absolute inset-x-0 bottom-28 z-20 px-4 sm:px-8">
            <ApprovalPrompt
              key={awaitingApproval.itemId}
              turnId={awaitingApproval.turnId}
              itemId={awaitingApproval.itemId}
              attempt={awaitingApproval.attempt}
              threadId={threadId}
              onResume={handleResumeTurn}
              onRequestChanges={handleRequestChanges}
              onSubmitQuestions={handleSubmitQuestions}
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

      <SessionStatsSheet
        open={statsSheetOpen}
        onOpenChange={setStatsSheetOpen}
        threadId={threadId}
        messages={safeMessages}
        activeTurn={turn}
        isStreaming={isStreaming}
        selectedTurnId={selectedTurnId}
      />
    </div>
  )
}
