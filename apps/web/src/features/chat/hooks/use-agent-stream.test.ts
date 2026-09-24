import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import {
  notifyManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query"
import { GlobalWindow } from "happy-dom"
import { toast } from "sonner"

if (typeof window === "undefined") {
  const win = new GlobalWindow({ url: "http://localhost:3000" })
  Object.assign(globalThis, {
    window: win,
    document: win.document,
    navigator: win.navigator,
    Element: win.Element,
    HTMLElement: win.HTMLElement,
    customElements: win.customElements,
  })
}

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

const { act, createElement } = await import("react")
const { createRoot } = await import("react-dom/client")

notifyManager.setScheduler((cb) => act(cb))

const { useAgentStream } = await import("./use-agent-stream")

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
      return createElement("div", null, result.current.projection.status)
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

  it("initializes with idle projection", () => {
    const hook = renderStreamHook()
    expect(hook.current).toBeDefined()
    expect(hook.current.projection.status).toBe("idle")
    expect(hook.current.projection.streamingText).toBe("")
    expect(hook.current.isStreaming).toBe(false)
  })

  it("streams SSE events, accumulates deltas, and completes turn", async () => {
    const threadId = "0191eb5d-7a6c-7e6d-9290-349c2a61c3e1"
    const turnId = "0191eb5d-7a6c-7e6d-9290-349c2a61c3e2"
    const itemId = "0191eb5d-7a6c-7e6d-9290-349c2a61c3e3"

    const ssePayload = [
      `data: {"type":"turn_started","data":{"thread_id":"${threadId}","turn_id":"${turnId}"}}\n\n`,
      `data: {"type":"item_started","data":{"thread_id":"${threadId}","turn_id":"${turnId}","item_id":"${itemId}","kind":"agent_message"}}\n\n`,
      `data: {"type":"item_delta","data":{"item_id":"${itemId}","delta":{"kind":"thinking_delta","text":"Checking stats..."}}}\n\n`,
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

    expect(hook.current.projection.status).toBe("completed")
    expect(hook.current.projection.streamingText).toBe("Mint chip is up 12%.")
    expect(hook.current.projection.streamingThinking).toBe("Checking stats...")
    expect(hook.current.isStreaming).toBe(false)
    expect(invalidateSpy).toHaveBeenCalled()
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
      sendPromise = hook.current.send("Long task")
    })

    expect(hook.current.isStreaming).toBe(true)

    act(() => {
      hook.current.stop()
    })

    await act(async () => {
      await sendPromise
    })

    expect(hook.current.projection.status).toBe("idle")
    expect(hook.current.isStreaming).toBe(false)
    expect(toastSpy).not.toHaveBeenCalled()
  })

  it("surfaces error toast on HTTP failure", async () => {
    globalThis.fetch = mock(
      async () =>
        new Response(JSON.stringify({ error: "Agent runtime down" }), {
          status: 502,
          headers: { "Content-Type": "application/json" },
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

    expect(hook.current.projection.status).toBe("error")
    expect(hook.current.projection.error).toBe("Agent runtime down")
    expect(toastCalls.length).toBe(1)
    expect(toastCalls[0][0]).toBe("Chat error")
  })
})
