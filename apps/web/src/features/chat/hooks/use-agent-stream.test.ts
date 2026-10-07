import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import {
  notifyManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query"
import { toast } from "sonner"
import { chatKeys } from "../queries/chat-queries"
import type { ChatMessage } from "../types"

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

const { act, createElement } = await import("react")
const { createRoot } = await import("react-dom/client")

notifyManager.setScheduler((cb) => act(cb))

const { describeStreamError, useAgentStream } = await import(
  "./use-agent-stream"
)

describe("useAgentStream Hook", () => {
  let container: HTMLDivElement | null = null
  let root: ReturnType<typeof createRoot> | null = null
  let queryClient: QueryClient
  const originalFetch = globalThis.fetch
  const originalToastError = toast.error

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    if (root) {
      try {
        act(() => root?.unmount())
      } catch {
        // Ignore unmount error if already unmounted
      }
      root = null
    }
    if (container?.parentNode) {
      container.parentNode.removeChild(container)
      container = null
    }
    globalThis.fetch = originalFetch
    toast.error = originalToastError
  })

  function renderStreamHook(): { current: ReturnType<typeof useAgentStream> } {
    const result = {
      current: null as unknown as ReturnType<typeof useAgentStream>,
    }

    function TestComponent() {
      result.current = useAgentStream()
      return createElement(
        "div",
        null,
        result.current.isStreaming ? "streaming" : "idle",
      )
    }

    act(() => {
      root?.render(
        createElement(
          QueryClientProvider,
          { client: queryClient },
          createElement(TestComponent),
        ),
      )
    })

    return result
  }

  it("initializes with isStreaming=false", () => {
    const hook = renderStreamHook()
    expect(hook.current).toBeDefined()
    expect(hook.current.isStreaming).toBe(false)
  })

  it("streams SSE events, accumulates deltas in query cache, and completes turn", async () => {
    const threadId = "0191eb5d-7a6c-7e6d-9290-349c2a61c3e1"
    const turnId = "0191eb5d-7a6c-7e6d-9290-349c2a61c3e2"
    const itemId = "0191eb5d-7a6c-7e6d-9290-349c2a61c3e3"

    const ssePayload = [
      `data: {"type":"turn_started","data":{"thread_id":"${threadId}","turn_id":"${turnId}"}}\n\n`,
      `data: {"type":"item_started","data":{"thread_id":"${threadId}","turn_id":"${turnId}","item_id":"${itemId}","kind":"agent_message"}}\n\n`,
      `data: {"type":"item_delta","data":{"item_id":"${itemId}","delta":{"kind":"thinking_delta","block_id":"r-1","text":"Checking stats..."}}}\n\n`,
      `data: {"type":"item_delta","data":{"item_id":"${itemId}","delta":{"kind":"text_delta","text":"Mint chip is up 12%."}}}\n\n`,
      `data: {"type":"turn_completed","data":{"thread_id":"${threadId}","turn_id":"${turnId}","status":"completed","usage":{"prompt_tokens":10,"completion_tokens":20,"total_tokens":30}}}\n\n`,
    ].join("")

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(ssePayload))
        controller.close()
      },
    })

    globalThis.fetch = mock(
      async () =>
        new Response(stream, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        }),
    ) as unknown as typeof fetch

    const invalidateSpy = mock(() => Promise.resolve())
    queryClient.invalidateQueries =
      invalidateSpy as unknown as typeof queryClient.invalidateQueries

    const hook = renderStreamHook()

    await act(async () => {
      await hook.current.send("Compare mint chip", threadId)
    })

    expect(hook.current.isStreaming).toBe(false)
    expect(invalidateSpy).toHaveBeenCalled()

    // Assert query cache contains user message and finalized agent message
    const cachedMessages = queryClient.getQueryData<ChatMessage[]>(
      chatKeys.messages(threadId),
    )
    expect(cachedMessages).toBeDefined()
    expect(cachedMessages).toHaveLength(2)

    const [userMsg, agentMsg] = cachedMessages ?? []
    expect(userMsg?.role).toBe("user")
    expect(userMsg?.content).toBe("Compare mint chip")

    expect(agentMsg?.role).toBe("agent")
    expect(agentMsg?.id).toBe(itemId)
    expect(agentMsg?.content).toBe("Mint chip is up 12%.")
    expect(agentMsg?.thinking).toBe("Checking stats...")
    expect(agentMsg?.status).toBe("completed")
  })

  it("handles user stop() cancellation without triggering error toast", async () => {
    globalThis.fetch = mock(async (_url, init) => {
      let streamController: ReadableStreamDefaultController | null = null
      const stream = new ReadableStream({
        start(controller) {
          streamController = controller
          controller.enqueue(
            new TextEncoder().encode(
              'data: {"type":"turn_started","data":{"thread_id":"0191eb5d-7a6c-7e6d-9290-349c2a61c3e1","turn_id":"0191eb5d-7a6c-7e6d-9290-349c2a61c3e2"}}\n\n',
            ),
          )
        },
      })
      init?.signal?.addEventListener("abort", () => {
        try {
          streamController?.error(
            new DOMException("The operation was aborted", "AbortError"),
          )
        } catch {
          // Already closed/aborted
        }
      })
      return new Response(stream, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      })
    }) as unknown as typeof fetch

    const toastSpy = mock(() => "")
    toast.error = toastSpy as unknown as typeof toast.error

    const hook = renderStreamHook()

    let sendPromise: Promise<void>
    act(() => {
      sendPromise = hook.current.send(
        "Long task",
        "0191eb5d-7a6c-7e6d-9290-349c2a61c3e1",
      )
    })

    expect(hook.current.isStreaming).toBe(true)

    act(() => {
      hook.current.stop()
    })

    await act(async () => {
      await sendPromise
    })

    expect(hook.current.isStreaming).toBe(false)
    expect(toastSpy).not.toHaveBeenCalled()

    const cachedMessages = queryClient.getQueryData<ChatMessage[]>(
      chatKeys.messages("0191eb5d-7a6c-7e6d-9290-349c2a61c3e1"),
    )
    expect(cachedMessages).toBeDefined()
    expect(cachedMessages?.[1]?.status).toBe("completed")
  })

  it("surfaces error toast on HTTP failure with request reference", async () => {
    globalThis.fetch = mock(
      async () =>
        new Response(JSON.stringify({ error: "Agent runtime down" }), {
          status: 502,
          headers: {
            "Content-Type": "application/json",
            "x-request-id": "trace-502-req",
          },
        }),
    ) as unknown as typeof fetch

    const toastCalls: Array<[string, unknown]> = []
    toast.error = mock(((msg: string, opts: unknown) => {
      toastCalls.push([msg, opts])
      return ""
    }) as unknown as typeof toast.error)

    const hook = renderStreamHook()

    await act(async () => {
      await hook.current.send("Prompt")
    })

    expect(hook.current.lastRequestId).toBe("trace-502-req")
    expect(toastCalls.length).toBe(1)
    expect(toastCalls[0]?.[0]).toBe("Chat error")
    expect(toastCalls[0]?.[1]).toEqual({
      description: "Agent runtime down (Ref: trace-502-req)",
    })
  })

  it("surfaces error toast with request reference on stream_error SSE event", async () => {
    const ssePayload =
      'data: {"type":"stream_error","data":{"code":"MODEL_TIMEOUT","message":"Model timed out"}}\n\n'
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(ssePayload))
        controller.close()
      },
    })

    globalThis.fetch = mock(
      async () =>
        new Response(stream, {
          status: 200,
          headers: {
            "Content-Type": "text/event-stream",
            "x-request-id": "trace-sse-err-123",
          },
        }),
    ) as unknown as typeof fetch

    const toastCalls: Array<[string, unknown]> = []
    toast.error = mock(((msg: string, opts: unknown) => {
      toastCalls.push([msg, opts])
      return ""
    }) as unknown as typeof toast.error)

    const hook = renderStreamHook()

    await act(async () => {
      await hook.current.send("Prompt")
    })

    expect(hook.current.lastRequestId).toBe("trace-sse-err-123")
    expect(toastCalls.length).toBe(1)
    expect(toastCalls[0]?.[0]).toBe("Agent error")
    // The code is shown beside the message. Without it the toast said only
    // "Model timed out", which is a sentence rather than something you can look
    // up in the server's logs.
    expect(toastCalls[0]?.[1]).toEqual({
      description: "Model timed out (MODEL_TIMEOUT, Ref: trace-sse-err-123)",
    })
  })

  it("handles thread_id propagation and invalidates queries on turn_completed", async () => {
    const serverThreadId = "0191eb5d-7a6c-7e6d-9290-349c2a61c399"
    const turnId = "0191eb5d-7a6c-7e6d-9290-349c2a61c39a"

    const ssePayload = [
      `data: {"type":"turn_started","data":{"thread_id":"${serverThreadId}","turn_id":"${turnId}"}}\n\n`,
      `data: {"type":"turn_completed","data":{"thread_id":"${serverThreadId}","turn_id":"${turnId}"}}\n\n`,
    ].join("")

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(ssePayload))
        controller.close()
      },
    })

    const fetchPayloads: string[] = []
    globalThis.fetch = mock(async (_url, init) => {
      if (init?.body) {
        fetchPayloads.push(init.body as string)
      }
      return new Response(stream, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      })
    }) as unknown as typeof fetch

    const hook = renderStreamHook()

    // Turn 1: Initial prompt passed with threadId
    await act(async () => {
      await hook.current.send("First prompt", serverThreadId)
    })

    const firstBody = JSON.parse(fetchPayloads[0]) as {
      prompt: string
      thread_id?: string
    }
    expect(firstBody.prompt).toBe("First prompt")
    expect(firstBody.thread_id).toBe(serverThreadId)

    // Turn 2: Subsequent message sent using threadId
    const stream2 = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(ssePayload))
        controller.close()
      },
    })
    globalThis.fetch = mock(async (_url, init) => {
      if (init?.body) {
        fetchPayloads.push(init.body as string)
      }
      return new Response(stream2, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      })
    }) as unknown as typeof fetch

    await act(async () => {
      await hook.current.send("Second prompt", serverThreadId)
    })

    expect(fetchPayloads.length).toBe(2)
    const secondBody = JSON.parse(fetchPayloads[1]) as {
      prompt: string
      thread_id?: string
    }
    expect(secondBody.prompt).toBe("Second prompt")
    expect(secondBody.thread_id).toBe(serverThreadId)
  })
})

describe("what a failure tells the reader", () => {
  const REF = "01a10c08-4039-7555-8ad0-2d2f62e36043"

  it("says what happened, why, and which request", () => {
    // All three: the message for the reader, the code for the log, and the
    // reference that ties them together. A reference on its own sends you
    // hunting; a message on its own cannot be acted on.
    const description = describeStreamError(
      "the model provider could not be reached",
      "model_provider_unreachable",
      REF,
    )
    expect(description).toContain("could not be reached")
    expect(description).toContain("model_provider_unreachable")
    expect(description).toContain(REF)
  })

  it("still reports when the runtime sends no code", () => {
    const description = describeStreamError("something went wrong", "", REF)
    expect(description).toContain("something went wrong")
    expect(description).toContain(REF)
  })

  it("does not invent a reference it was not given", () => {
    expect(describeStreamError("it failed", "model_timeout", null)).toBe(
      "it failed (model_timeout)",
    )
  })

  it("keeps the code out of the sentence it is not part of", () => {
    // A stray pair of empty parentheses reads like a rendering bug and tells the
    // reader nothing.
    expect(describeStreamError("it failed", "", null)).toBe("it failed")
  })
})
