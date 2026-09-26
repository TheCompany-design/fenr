import { useQueryClient } from "@tanstack/react-query"
import { useAtom } from "jotai"
import { useCallback, useRef } from "react"
import { toast } from "sonner"
import { agentStreamEventSchema } from "@/lib/schemas/agent-stream"
import { chatKeys } from "../queries/chat-queries"
import { isStreamingAtom, lastRequestIdAtom } from "../state/chat-atoms"
import { chatMessagesReducer } from "../state/chat-messages-reducer"
import type { ChatMessage } from "../types"

export interface SendOptions {
  readonly onTurnStarted?: (threadId: string) => void | Promise<void>
}

export interface UseAgentStreamReturn {
  readonly lastRequestId: string | null
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
export function useAgentStream(): UseAgentStreamReturn {
  const [isStreaming, setIsStreaming] = useAtom(isStreamingAtom)
  const [lastRequestId, setLastRequestId] = useAtom(lastRequestIdAtom)
  const abortControllerRef = useRef<AbortController | null>(null)
  const activeKeyRef = useRef<readonly string[]>(chatKeys.messages(null))
  const queryClient = useQueryClient()

  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
      setIsStreaming(false)

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
                const validation = agentStreamEventSchema.safeParse(parsed)
                if (validation.success) {
                  const event = validation.data

                  if (event.type === "turn_started") {
                    const serverThreadId = event.data.thread_id
                    if (!threadId) {
                      // Migrate cache data from draft key to newly minted server thread key
                      const draftData =
                        queryClient.getQueryData<ChatMessage[]>(currentKey) ??
                        []
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

                  if (event.type === "turn_completed") {
                    setIsStreaming(false)
                    void queryClient.invalidateQueries({
                      queryKey: chatKeys.thread(event.data.thread_id),
                    })
                  }

                  if (event.type === "stream_error") {
                    setIsStreaming(false)
                    const description = activeRequestId
                      ? `${event.data.message} (Ref: ${activeRequestId})`
                      : event.data.message
                    toast.error("Agent error", { description })
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
    send,
    stop,
    reset,
    isStreaming,
  }
}
