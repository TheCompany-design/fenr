import { useQueryClient } from "@tanstack/react-query"
import { useAtom } from "jotai"
import { useCallback, useRef } from "react"
import { toast } from "sonner"
import { agentStreamEventSchema } from "@/lib/schemas/agent-stream"
import { chatKeys } from "../queries/chat-queries"
import {
  activeTurnProjectionAtom,
  lastRequestIdAtom,
} from "../state/chat-atoms"
import {
  type ActiveTurnProjection,
  initialTurnProjection,
  streamReducer,
} from "../state/stream-reducer"
import type { ChatMessage } from "../types"

export interface UseAgentStreamReturn {
  readonly projection: ActiveTurnProjection
  readonly lastRequestId: string | null
  readonly send: (prompt: string, threadId?: string | null) => Promise<void>
  readonly stop: () => void
  readonly reset: () => void
  readonly isStreaming: boolean
}

/**
 * Custom React hook managing real-time SSE streaming connection to the BFF proxy.
 * Encapsulates AbortController cancellation, line-buffered SSE chunk parsing,
 * Zod event validation, Jotai turn projection updates, and TanStack Query cache sync.
 */
export function useAgentStream(): UseAgentStreamReturn {
  const [projection, setProjection] = useAtom(activeTurnProjectionAtom)
  const [lastRequestId, setLastRequestId] = useAtom(lastRequestIdAtom)
  const abortControllerRef = useRef<AbortController | null>(null)
  const queryClient = useQueryClient()

  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
      setProjection((prev) =>
        prev.status === "streaming" ? { ...prev, status: "idle" } : prev,
      )
    }
  }, [setProjection])

  const reset = useCallback(() => {
    stop()
    setProjection(initialTurnProjection)
    setLastRequestId(null)
  }, [stop, setProjection, setLastRequestId])

  const send = useCallback(
    async (prompt: string, threadId?: string | null) => {
      stop()

      const trimmedPrompt = prompt.trim()
      if (!trimmedPrompt) {
        return
      }

      const abortController = new AbortController()
      abortControllerRef.current = abortController

      setProjection({
        ...initialTurnProjection,
        threadId: threadId ?? null,
        status: "streaming",
      })

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
                const validation = agentStreamEventSchema.safeParse(parsed)
                if (validation.success) {
                  const event = validation.data
                  setProjection((prev) => streamReducer(prev, event))

                  if (event.type === "turn_completed") {
                    const completedThreadId = event.data.thread_id

                    setProjection((current) => {
                      if (current.streamingText) {
                        queryClient.setQueryData<ChatMessage[]>(
                          chatKeys.messages(completedThreadId),
                          (old = []) => [
                            ...old,
                            {
                              id:
                                current.activeItemId ||
                                current.turnId ||
                                crypto.randomUUID(),
                              role: "agent",
                              content: current.streamingText,
                              thinking: current.streamingThinking || undefined,
                              createdAt: new Date().toISOString(),
                            },
                          ],
                        )
                      }
                      return current
                    })

                    void queryClient.invalidateQueries({
                      queryKey: chatKeys.thread(completedThreadId),
                    })
                  }

                  if (event.type === "stream_error") {
                    const description = activeRequestId
                      ? `${event.data.message} (Ref: ${activeRequestId})`
                      : event.data.message
                    toast.error("Agent error", {
                      description,
                    })
                  }
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
        setProjection((prev) => ({
          ...prev,
          status: "error",
          error: description,
        }))
      } finally {
        if (abortControllerRef.current === abortController) {
          abortControllerRef.current = null
        }
      }
    },
    [stop, setProjection, setLastRequestId, queryClient],
  )

  return {
    projection,
    lastRequestId,
    send,
    stop,
    reset,
    isStreaming: projection.status === "streaming",
  }
}
