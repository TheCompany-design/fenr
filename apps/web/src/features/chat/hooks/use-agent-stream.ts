import { useQueryClient } from "@tanstack/react-query"
import { useAtom } from "jotai"
import { useCallback, useState } from "react"
import { toast } from "sonner"
import { moduleLogger } from "@/lib/logger"
import { parseAgentStreamEvent } from "@/lib/schemas/agent-stream"
import { chatKeys } from "../queries/chat-queries"
import { isStreamingAtom, lastRequestIdAtom } from "../state/chat-atoms"
import { chatMessagesReducer } from "../state/chat-messages-reducer"
import {
  type ActiveTurnProjection,
  applyStreamFrame,
  initialTurnProjection,
  streamReducer,
} from "../state/stream-reducer"
import type { ChatMessage } from "../types"

export interface SendOptions {
  readonly onTurnStarted?: (threadId: string) => void | Promise<void>

  /** Composio toolkit slugs the turn pins via `@app` mentions. */
  readonly pinnedToolkits?: string[]

  readonly providerConfigId?: string | null

  readonly modelId?: string | null

  readonly effort?: string | null

  readonly onModelCallRecorded?: (call: {
    savedConfigId: string | null
    modelId: string
    errorCode: string | null
  }) => void
}

export interface ResumeOptions {
  readonly onModelCallRecorded?: (call: {
    savedConfigId: string | null
    modelId: string
    errorCode: string | null
  }) => void
}

export interface UseAgentStreamReturn {
  readonly lastRequestId: string | null

  readonly turn: ActiveTurnProjection
  readonly send: (
    prompt: string,
    threadId?: string | null,
    options?: SendOptions,
  ) => Promise<void>
  readonly resume: (
    turnId: string,
    threadId?: string | null,
    options?: ResumeOptions,
  ) => Promise<void>
  readonly stop: () => void
  readonly isStreaming: boolean
}

const log = moduleLogger("chat:agent-stream")

function describeUnmodelledFrame(raw: unknown): {
  event_type: string | null
  reason: string
} {
  const candidate =
    typeof raw === "object" && raw !== null && "type" in raw
      ? (raw as { type?: unknown }).type
      : undefined
  const event_type = typeof candidate === "string" ? candidate : null
  return {
    event_type,
    reason: event_type
      ? "event type is not in the client contract"
      : "frame is not an agent stream event",
  }
}

export function describeStreamError(
  message: string,
  code: string,
  requestId: string | null,
): string {
  const reason = code ? `${message} (${code}` : message
  return requestId
    ? `${reason}, Ref: ${requestId})`
    : code
      ? `${message} (${code})`
      : message
}

export function streamErrorTitle(code: string): string {
  switch (code) {
    case "tenant_provider_unconfigured":
      return "This workspace has no model provider"
    case "tenant_provider_endpoint_blocked":
      return "The model endpoint is unreachable from the runtime"
    case "model_provider_auth_rejected":
      return "The provider rejected its API key"
    case "model_provider_not_found":
      return "The provider could not find that endpoint or model"
    case "model_provider_overloaded":
      return "The model provider is temporarily overloaded"
    default:
      return "Agent error"
  }
}

let activeAbortController: AbortController | null = null
let activeMessagesKey: readonly string[] = chatKeys.messages(null)

export function useAgentStream(): UseAgentStreamReturn {
  const [isStreaming, setIsStreaming] = useAtom(isStreamingAtom)
  const [lastRequestId, setLastRequestId] = useAtom(lastRequestIdAtom)
  const [turn, setTurn] = useState<ActiveTurnProjection>(initialTurnProjection)
  const queryClient = useQueryClient()

  const stop = useCallback(() => {
    if (activeAbortController) {
      activeAbortController.abort()
      activeAbortController = null
      setIsStreaming(false)
      setTurn((previous) => ({
        ...previous,
        status: previous.status === "suspended" ? previous.status : "idle",
        activeItemId: null,
        streamingText: "",
        streamingToolArguments: "",
      }))

      queryClient.setQueryData<ChatMessage[]>(activeMessagesKey, (old = []) =>
        chatMessagesReducer(old, {
          type: "stream_stopped",
        }),
      )
    }
  }, [setIsStreaming, queryClient])

  const consumeAgentStream = useCallback(
    async ({
      body,
      threadId,
      abortController,
      options,
    }: {
      body: Record<string, unknown>
      threadId?: string | null
      abortController: AbortController
      options?: SendOptions
    }) => {
      let currentKey: readonly string[] = chatKeys.messages(threadId)
      activeMessagesKey = currentKey
      let activeRequestId: string | null = null

      try {
        const response = await fetch("/api/agent/stream", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
          },
          body: JSON.stringify(body),
          signal: abortController.signal,
        })

        activeRequestId = response.headers.get("x-request-id")
        setLastRequestId(activeRequestId)

        if (!response.ok || !response.body) {
          let errorText = response.statusText || "Request failed"
          try {
            const errJson = (await response.json()) as { error?: string }
            if (errJson?.error) {
              errorText = errJson.error
            }
          } catch {
            // Fallback to statusText
          }
          const refMessage = activeRequestId
            ? `${errorText} (Ref: ${activeRequestId})`
            : errorText
          throw new Error(refMessage)
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ""

        while (true) {
          const { value, done } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n")
          buffer = lines.pop() ?? ""

          for (const line of lines) {
            const trimmed = line.trim()
            if (trimmed.startsWith("data:")) {
              const rawJson = trimmed.slice(5).trim()
              if (!rawJson) continue
              try {
                const parsed: unknown = JSON.parse(rawJson)
                const validation = parseAgentStreamEvent(parsed)

                if (!validation.ok) {
                  const detail = describeUnmodelledFrame(parsed)
                  setTurn((previous) =>
                    applyStreamFrame(previous, parsed, (unmodelled) =>
                      log.warn(
                        {
                          ...detail,
                          validation_error: unmodelled.error,
                          request_id: activeRequestId,
                        },
                        "an agent stream frame was not applied",
                      ),
                    ),
                  )
                  continue
                }

                const event = validation.event
                if (event.type === "model_call_recorded") {
                  options?.onModelCallRecorded?.({
                    savedConfigId: event.data.saved_config_id,
                    modelId: event.data.model,
                    errorCode: event.data.error_code,
                  })
                }
                setTurn((previous) => streamReducer(previous, event))
                if (event.type === "turn_started") {
                  const serverThreadId = event.data.thread_id
                  if (!threadId) {
                    const draftData =
                      queryClient.getQueryData<ChatMessage[]>(currentKey) ?? []
                    currentKey = chatKeys.messages(serverThreadId)
                    activeMessagesKey = currentKey
                    queryClient.setQueryData(currentKey, draftData)
                    queryClient.removeQueries({
                      queryKey: chatKeys.messages(null),
                    })
                    void queryClient.invalidateQueries({
                      queryKey: chatKeys.threads(),
                    })
                  }

                  if (options?.onTurnStarted) {
                    try {
                      await options.onTurnStarted(serverThreadId)
                    } catch {
                      // Ignore navigation errors during active stream
                    }
                  }
                }

                if (event.type === "turn_resumed") {
                  const serverThreadId = event.data.thread_id
                  if (!threadId && serverThreadId) {
                    currentKey = chatKeys.messages(serverThreadId)
                    activeMessagesKey = currentKey
                  }
                }

                queryClient.setQueryData<ChatMessage[]>(
                  currentKey,
                  (old = []) =>
                    chatMessagesReducer(old, {
                      type: "agent_event",
                      event,
                    }),
                )

                if (event.type === "turn_suspended") {
                  setIsStreaming(false)
                  void queryClient.invalidateQueries({
                    queryKey: chatKeys.thread(event.data.thread_id),
                  })
                }

                if (event.type === "turn_resumed") {
                  setIsStreaming(true)
                  void queryClient.invalidateQueries({
                    queryKey: chatKeys.thread(event.data.thread_id),
                  })
                }

                if (event.type === "turn_completed") {
                  setIsStreaming(false)
                  void queryClient.invalidateQueries({
                    queryKey: chatKeys.threads(),
                  })
                  void queryClient.invalidateQueries({
                    queryKey: chatKeys.thread(event.data.thread_id),
                  })
                  void queryClient.invalidateQueries({
                    queryKey: chatKeys.usage(event.data.thread_id),
                  })
                  if (!threadId) {
                    for (const delayMs of [2000, 5000]) {
                      setTimeout(() => {
                        void queryClient.invalidateQueries({
                          queryKey: chatKeys.threads(),
                        })
                      }, delayMs)
                    }
                  }
                }

                if (event.type === "stream_error") {
                  setIsStreaming(false)
                  toast.error(streamErrorTitle(event.data.code), {
                    description: describeStreamError(
                      event.data.message,
                      event.data.code,
                      activeRequestId,
                    ),
                  })
                }
              } catch {
                // Ignore malformed ping or non-JSON comments safely
              }
            }
          }
        }
      } catch (err: unknown) {
        if (
          (err instanceof DOMException && err.name === "AbortError") ||
          (err instanceof Error && err.name === "AbortError")
        ) {
          return
        }

        const message =
          err instanceof Error ? err.message : "Failed to stream agent response"
        const description =
          activeRequestId && !message.includes("Ref:")
            ? `${message} (Ref: ${activeRequestId})`
            : message
        toast.error("Chat error", { description })

        queryClient.setQueryData<ChatMessage[]>(currentKey, (old = []) =>
          chatMessagesReducer(old, {
            type: "agent_event",
            event: {
              type: "stream_error",
              data: {
                code: "INTERNAL_ERROR",
                message: description,
              },
            },
          }),
        )
      } finally {
        if (activeAbortController === abortController) {
          activeAbortController = null
          setIsStreaming(false)
        }
      }
    },
    [setLastRequestId, setIsStreaming, queryClient],
  )

  const send = useCallback(
    async (prompt: string, threadId?: string | null, options?: SendOptions) => {
      stop()

      const trimmedPrompt = prompt.trim()
      if (!trimmedPrompt) {
        return
      }

      const abortController = new AbortController()
      activeAbortController = abortController
      setIsStreaming(true)
      setTurn(initialTurnProjection)

      const currentKey = chatKeys.messages(threadId)
      activeMessagesKey = currentKey

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: trimmedPrompt,
        status: "completed",
        createdAt: new Date().toISOString(),
      }
      const agentPlaceholder: ChatMessage = {
        id: crypto.randomUUID(),
        role: "agent",
        content: "",
        thinking: "",
        status: "streaming",
        createdAt: new Date().toISOString(),
        unclaimed: true,
      }

      queryClient.setQueryData<ChatMessage[]>(currentKey, (old = []) =>
        chatMessagesReducer(old, {
          type: "client_send",
          payload: { userMessage, agentMessage: agentPlaceholder },
        }),
      )

      await consumeAgentStream({
        body: {
          prompt: trimmedPrompt,
          thread_id: threadId ?? undefined,
          provider_config_id: options?.providerConfigId ?? undefined,
          model: options?.modelId ?? undefined,
          effort: options?.effort ?? undefined,
          integrations:
            options?.pinnedToolkits && options.pinnedToolkits.length > 0
              ? {
                  pinned_toolkits: options.pinnedToolkits,
                  allow_workspace_discovery: false,
                }
              : undefined,
        },
        threadId,
        abortController,
        options,
      })
    },
    [stop, setIsStreaming, queryClient, consumeAgentStream],
  )

  const resume = useCallback(
    async (
      turnId: string,
      threadId?: string | null,
      options?: ResumeOptions,
    ) => {
      stop()

      const trimmedTurnId = turnId.trim()
      if (!trimmedTurnId) {
        return
      }

      const abortController = new AbortController()
      activeAbortController = abortController
      setIsStreaming(true)
      setTurn((previous) => ({
        ...previous,
        threadId: threadId ?? previous.threadId,
        turnId: trimmedTurnId,
        status: "streaming",
        awaitingApprovalItemId: null,
        approvalAttempt: null,
        activeItemId: null,
        error: null,
        errorCode: null,
      }))

      await consumeAgentStream({
        body: {
          resume_turn_id: trimmedTurnId,
          thread_id: threadId ?? undefined,
        },
        threadId,
        abortController,
        options,
      })
    },
    [stop, setIsStreaming, consumeAgentStream],
  )

  return {
    lastRequestId,
    turn,
    send,
    resume,
    stop,
    isStreaming,
  }
}
