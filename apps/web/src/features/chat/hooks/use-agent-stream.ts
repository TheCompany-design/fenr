import { useQueryClient } from "@tanstack/react-query"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { agentStreamEventSchema } from "@/lib/schemas/agent-stream"
import {
  type ActiveTurnProjection,
  initialTurnProjection,
  streamReducer,
} from "../state/stream-reducer"

export interface UseAgentStreamReturn {
  readonly projection: ActiveTurnProjection
  readonly send: (prompt: string, threadId?: string | null) => Promise<void>
  readonly stop: () => void
  readonly reset: () => void
  readonly isStreaming: boolean
}

/**
 * Custom React hook managing real-time SSE streaming connection to the BFF proxy.
 * Encapsulates AbortController cancellation, line-buffered SSE chunk parsing,
 * Zod event validation, pure reducer dispatching, query invalidation, and Sonner alerts.
 */
export function useAgentStream(): UseAgentStreamReturn {
  const [projection, setProjection] = useState<ActiveTurnProjection>(
    initialTurnProjection,
  )
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
  }, [])

  const reset = useCallback(() => {
    stop()
    setProjection(initialTurnProjection)
  }, [stop])

  // Cleanup in-flight requests when component unmounts
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }
    }
  }, [])

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
          throw new Error(errorText)
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
                    void queryClient.invalidateQueries({
                      queryKey: ["chat", "threads", event.data.thread_id],
                    })
                  }
                  if (event.type === "stream_error") {
                    toast.error("Agent error", {
                      description: event.data.message,
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
        toast.error("Chat error", { description: message })
        setProjection((prev) => ({
          ...prev,
          status: "error",
          error: message,
        }))
      } finally {
        if (abortControllerRef.current === abortController) {
          abortControllerRef.current = null
        }
      }
    },
    [stop, queryClient],
  )

  return {
    projection,
    send,
    stop,
    reset,
    isStreaming: projection.status === "streaming",
  }
}
