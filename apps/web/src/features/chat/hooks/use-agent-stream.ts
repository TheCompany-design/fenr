import { useQueryClient } from "@tanstack/react-query"
import { useAtom } from "jotai"
import { useCallback, useRef, useState } from "react"
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
}

export interface UseAgentStreamReturn {
  readonly lastRequestId: string | null
  /**
   * The turn as the server describes it.
   *
   * `status: "suspended"` is the state that matters: the turn is parked on a
   * decision, so the interface has to offer one rather than wait.
   */
  readonly turn: ActiveTurnProjection
  readonly send: (
    prompt: string,
    threadId?: string | null,
    options?: SendOptions,
  ) => Promise<void>
  readonly stop: () => void
  readonly reset: () => void
  readonly isStreaming: boolean
}

/**
 * Custom React hook managing real-time SSE streaming connection to the BFF proxy.
 * Directly drives in-place updates into TanStack Query's cache via chatMessagesReducer,
 * guaranteeing a single authoritative message timeline with zero duplicate bubbles.
 */
const log = moduleLogger("chat:agent-stream")

/**
 * The reason a frame was not applied.
 *
 * `type` is taken from the raw frame rather than from a schema so that an event
 * this client has never heard of can still be *named* in the log. A frame with
 * no usable type is reported as such instead of vanishing.
 */
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

/**
 * What the toast says when a turn fails.
 *
 * The runtime sends a message written for a person and a code written for a
 * machine, and both are shown: the message says what happened, the code is what
 * makes the report findable in the server's logs, and the reference ties the two
 * together. The message alone once left every failure reading identically.
 */
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

/**
 * What to call a turn that could not run.
 *
 * Most failures are "Agent error", which is honest and unhelpful in equal measure.
 * Two codes are the user having a problem this interface can point at, so they get
 * a title that names the problem rather than the subsystem:
 *
 * - `tenant_provider_unconfigured` is the workspace having nobody set its model
 *   endpoint up yet. It is the first thing every new workspace meets, and calling
 *   it an agent error sends the reader looking in the wrong place.
 * - `tenant_provider_endpoint_blocked` is a deployment-level refusal to dial an
 *   address. Nothing about the user's key or message is wrong, and the title says
 *   so — otherwise it reads as though their input caused it.
 *
 * Anything unrecognised falls through to the generic title, which is also what
 * makes adding a code here optional rather than required.
 */
export function streamErrorTitle(code: string): string {
  switch (code) {
    case "tenant_provider_unconfigured":
      return "This workspace has no model provider"
    case "tenant_provider_endpoint_blocked":
      return "The model endpoint is unreachable from the runtime"
    default:
      return "Agent error"
  }
}

export function useAgentStream(): UseAgentStreamReturn {
  const [isStreaming, setIsStreaming] = useAtom(isStreamingAtom)
  const [lastRequestId, setLastRequestId] = useAtom(lastRequestIdAtom)
  const [turn, setTurn] = useState<ActiveTurnProjection>(initialTurnProjection)
  const abortControllerRef = useRef<AbortController | null>(null)
  const activeKeyRef = useRef<readonly string[]>(chatKeys.messages(null))
  const queryClient = useQueryClient()

  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
      setIsStreaming(false)
      setTurn((previous) => ({
        ...previous,
        // A client-side stop ends the connection, not necessarily the turn: the
        // runtime may keep working and be read back from its transcript. So the
        // turn is left identified, and only marked as not streaming here.
        status: previous.status === "suspended" ? previous.status : "idle",
        activeItemId: null,
        streamingText: "",
        streamingToolArguments: "",
      }))

      queryClient.setQueryData<ChatMessage[]>(
        activeKeyRef.current,
        (old = []) =>
          chatMessagesReducer(old, {
            type: "stream_stopped",
          }),
      )
    }
  }, [setIsStreaming, queryClient])

  const reset = useCallback(() => {
    stop()
    setLastRequestId(null)
  }, [stop, setLastRequestId])

  const send = useCallback(
    async (prompt: string, threadId?: string | null, options?: SendOptions) => {
      stop()

      const trimmedPrompt = prompt.trim()
      if (!trimmedPrompt) {
        return
      }

      const abortController = new AbortController()
      abortControllerRef.current = abortController
      setIsStreaming(true)
      // A new turn starts from nothing: carrying the previous turn's text or
      // approval item across would attribute them to this one.
      setTurn(initialTurnProjection)

      let currentKey: readonly string[] = chatKeys.messages(threadId)
      activeKeyRef.current = currentKey

      // Optimistically append user message and in-flight streaming placeholder
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
        // Until the runtime names this bubble, the first assistant item claims
        // it. Every later item gets its own bubble instead.
        unclaimed: true,
      }

      queryClient.setQueryData<ChatMessage[]>(currentKey, (old = []) =>
        chatMessagesReducer(old, {
          type: "client_send",
          payload: { userMessage, agentMessage: agentPlaceholder },
        }),
      )

      let activeRequestId: string | null = null

      try {
        const response = await fetch("/api/agent/stream", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
          },
          body: JSON.stringify({
            prompt: trimmedPrompt,
            thread_id: threadId ?? undefined,
          }),
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
                  // The server adds capability as new event types precisely so
                  // an older client keeps working. Dropping the frame quietly is
                  // how a suspended turn turns into an unexplained spinner, so
                  // it is recorded, the projection is left alone, and the
                  // stream continues.
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
                setTurn((previous) => streamReducer(previous, event))
                if (event.type === "turn_started") {
                  const serverThreadId = event.data.thread_id
                  if (!threadId) {
                    // Migrate cache data from draft key to newly minted server thread key
                    const draftData =
                      queryClient.getQueryData<ChatMessage[]>(currentKey) ?? []
                    currentKey = chatKeys.messages(serverThreadId)
                    activeKeyRef.current = currentKey
                    queryClient.setQueryData(currentKey, draftData)
                    queryClient.removeQueries({
                      queryKey: chatKeys.messages(null),
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

                // Dispatch event directly into the query cache via pure reducer
                queryClient.setQueryData<ChatMessage[]>(
                  currentKey,
                  (old = []) =>
                    chatMessagesReducer(old, {
                      type: "agent_event",
                      event,
                    }),
                )

                if (event.type === "turn_suspended") {
                  // The turn is parked on a human decision. The stream stays
                  // open, but the composer must not be blocked by a turn that
                  // is no longer running.
                  setIsStreaming(false)
                }

                if (event.type === "turn_resumed") {
                  setIsStreaming(true)
                }

                if (event.type === "turn_completed") {
                  // Every terminal status ends the turn, including a cancelled
                  // one: leaving the composer disabled here is what made a
                  // cancelled turn look like a hung request.
                  setIsStreaming(false)
                  void queryClient.invalidateQueries({
                    queryKey: chatKeys.thread(event.data.thread_id),
                  })
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
        setIsStreaming(false)
        if (abortControllerRef.current === abortController) {
          abortControllerRef.current = null
        }
      }
    },
    [stop, setLastRequestId, setIsStreaming, queryClient],
  )

  return {
    lastRequestId,
    turn,
    send,
    stop,
    reset,
    isStreaming,
  }
}
