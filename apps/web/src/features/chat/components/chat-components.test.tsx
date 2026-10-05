import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import {
  notifyManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query"
import { GlobalWindow } from "happy-dom"
import { toast } from "sonner"
import type { ChatMessage } from "../types"

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

const { ThinkingTrace } = await import("./thinking-trace")
const { ChatTurnBlock } = await import("./chat-turn-block")
const { groupIntoTurns } = await import("../state/chat-turns")
const { ChatComposer } = await import("./chat-composer")
const { ChatMessages } = await import("./chat-messages")
const { ChatContainer } = await import("./chat-container")

function setNativeValue(el: HTMLElement, val: string) {
  const isTextArea = el instanceof HTMLTextAreaElement
  const proto = isTextArea
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype
  const set = Object.getOwnPropertyDescriptor(proto, "value")?.set
  const tracker = (
    el as unknown as { _valueTracker?: { setValue: (v: string) => void } }
  )._valueTracker
  if (tracker) {
    tracker.setValue("__prev_diff_value__")
  }
  set?.call(el, val)
  el.dispatchEvent(new Event("input", { bubbles: true }))
  el.dispatchEvent(new Event("change", { bubbles: true }))
}

describe("Chat Components (Beautiful UI Adapted Primitives)", () => {
  let container: HTMLDivElement | null = null
  let root: ReturnType<typeof createRoot> | null = null
  let queryClient: QueryClient

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
        // Ignored
      }
      root = null
    }
    if (container?.parentNode) {
      container.parentNode.removeChild(container)
      container = null
    }
  })

  describe("ThinkingTrace", () => {
    it("renders streaming thinking state with shimmer and disclosure", () => {
      act(() => {
        root?.render(
          createElement(ThinkingTrace, {
            thinking: "Analyzing bank reconciliation...",
            isStreaming: true,
            defaultExpanded: true,
          }),
        )
      })

      expect(container?.textContent).toContain("Thinking...")
      expect(container?.textContent).toContain(
        "Analyzing bank reconciliation...",
      )
    })

    it("renders settled thinking trace and toggles disclosure on click", () => {
      act(() => {
        root?.render(
          createElement(ThinkingTrace, {
            thinking: "Checked 14 transactions.",
            isStreaming: false,
            defaultExpanded: false,
          }),
        )
      })

      expect(container?.textContent).toContain("Thought process")
      expect(container?.textContent).not.toContain("Checked 14 transactions.")

      const button = container?.querySelector("button")
      expect(button).toBeDefined()

      act(() => {
        button?.click()
      })

      expect(container?.textContent).toContain("Checked 14 transactions.")
    })
  })

  describe("ChatTurnBlock", () => {
    it("renders a user message without an avatar", () => {
      const msg: ChatMessage = {
        id: "msg-user-avatar",
        role: "user",
        content: "no avatar here",
      }

      act(() => {
        root?.render(
          createElement(ChatTurnBlock, { turn: groupIntoTurns([msg])[0] }),
        )
      })

      expect(container?.textContent).toContain("no avatar here")
      expect(container?.querySelector("svg")).toBeNull()
    })

    it("renders user message bubble cleanly", () => {
      const msg: ChatMessage = {
        id: "msg-user-1",
        role: "user",
        content: "What is my ledger balance?",
        createdAt: "10:30 AM",
      }

      act(() => {
        root?.render(
          createElement(ChatTurnBlock, { turn: groupIntoTurns([msg])[0] }),
        )
      })

      expect(container?.textContent).toContain("What is my ledger balance?")
    })

    it("names the reply without an avatar beside it", () => {
      const msg: ChatMessage = {
        id: "msg-agent-avatar",
        role: "agent",
        content: "no badge here",
      }

      act(() => {
        root?.render(
          createElement(ChatTurnBlock, { turn: groupIntoTurns([msg])[0] }),
        )
      })

      // Nothing marks the reply as the agent's: it sits on the left, opposite
      // the reader's messages. A badge and a label both said what position
      // already says.
      expect(container?.textContent).toContain("no badge here")
      expect(container?.textContent).not.toContain("Nabu Agent")
      expect(container?.querySelector(".size-7")).toBeNull()
    })

    it("dates the reply at its end, as a formatted time", () => {
      const at = new Date()
      at.setHours(14, 32, 0, 0)
      const msg: ChatMessage = {
        id: "msg-agent-stamp",
        role: "agent",
        content: "answered",
        createdAt: at.toISOString(),
      }

      act(() => {
        root?.render(
          createElement(ChatTurnBlock, { turn: groupIntoTurns([msg])[0] }),
        )
      })

      // The stored value is a full ISO timestamp; it must not reach the reader.
      expect(container?.textContent).not.toContain("T")
      expect(container?.textContent).toContain("14:32")

      const time = container?.querySelector("time")
      expect(time?.getAttribute("datetime")).toBe(at.toISOString())
    })

    it("renders agent message with thinking trace and streaming indicator", () => {
      const msg: ChatMessage = {
        id: "msg-agent-1",
        role: "agent",
        content: "Your balance is $5,240.00",
        thinking: "Fetched from core ledger database",
        createdAt: "10:31 AM",
      }

      act(() => {
        root?.render(
          createElement(ChatTurnBlock, { turn: groupIntoTurns([msg])[0] }),
        )
      })

      expect(container?.textContent).toContain("Your balance is $5,240.00")
      expect(container?.textContent).toContain(
        "Fetched from core ledger database",
      )
    })

    it("handles copy to clipboard action", async () => {
      const msg: ChatMessage = {
        id: "msg-agent-2",
        role: "agent",
        content: "Copy this text",
      }

      let copiedText = ""
      Object.defineProperty(navigator, "clipboard", {
        value: {
          writeText: async (text: string) => {
            copiedText = text
          },
        },
        configurable: true,
      })

      const toastSuccessSpy = mock(() => "")
      toast.success = toastSuccessSpy as unknown as typeof toast.success

      act(() => {
        root?.render(
          createElement(ChatTurnBlock, { turn: groupIntoTurns([msg])[0] }),
        )
      })

      const copyBtn = container?.querySelector(
        'button[aria-label="Copy response"]',
      ) as HTMLButtonElement
      expect(copyBtn).toBeDefined()

      await act(async () => {
        copyBtn?.click()
      })

      expect(copiedText).toBe("Copy this text")
      expect(toastSuccessSpy).toHaveBeenCalled()
    })
  })

  describe("ChatComposer", () => {
    it("submits message on form submission and clears input", async () => {
      const sendSpy = mock(() => {})
      const stopSpy = mock(() => {})

      act(() => {
        root?.render(
          createElement(ChatComposer, {
            onSend: sendSpy,
            onStop: stopSpy,
            isStreaming: false,
          }),
        )
      })

      const textarea = container?.querySelector(
        "textarea",
      ) as HTMLTextAreaElement
      expect(textarea).toBeDefined()

      act(() => {
        setNativeValue(textarea, "New calculation")
      })

      const submitBtn = container?.querySelector(
        'button[type="submit"]',
      ) as HTMLButtonElement
      expect(submitBtn).toBeDefined()

      await act(async () => {
        submitBtn?.click()
      })

      expect(sendSpy).toHaveBeenCalledWith("New calculation")
    })

    it("renders stop button and triggers onStop when streaming", () => {
      const sendSpy = mock(() => {})
      const stopSpy = mock(() => {})

      act(() => {
        root?.render(
          createElement(ChatComposer, {
            onSend: sendSpy,
            onStop: stopSpy,
            isStreaming: true,
          }),
        )
      })

      const stopBtn = container?.querySelector(
        'button[aria-label="Stop generating"]',
      ) as HTMLButtonElement
      expect(stopBtn).toBeDefined()

      act(() => {
        stopBtn?.click()
      })

      expect(stopSpy).toHaveBeenCalled()
    })

    it("populates textarea when a suggestion pill is clicked", () => {
      act(() => {
        root?.render(
          createElement(ChatComposer, {
            onSend: () => {},
            onStop: () => {},
            suggestions: ["Check inventory"],
          }),
        )
      })

      const pill = container?.querySelectorAll("button")[0]
      expect(pill?.textContent).toBe("Check inventory")

      act(() => {
        pill?.click()
      })

      const textarea = container?.querySelector(
        "textarea",
      ) as HTMLTextAreaElement
      expect(textarea.value).toBe("Check inventory")
    })
  })

  describe("ChatMessages", () => {
    it("renders empty state illustration when no messages are present", () => {
      act(() => {
        root?.render(
          createElement(ChatMessages, {
            messages: [],
          }),
        )
      })

      expect(container?.textContent).toContain("How can Nabu assist you today?")
    })

    it("renders messages feed when messages are present", () => {
      const messages: ChatMessage[] = [
        { id: "1", role: "user", content: "Hello" },
        { id: "2", role: "agent", content: "Hi there!" },
      ]

      act(() => {
        root?.render(
          createElement(ChatMessages, {
            messages,
          }),
        )
      })

      expect(container?.textContent).toContain("Hello")
      expect(container?.textContent).toContain("Hi there!")
    })

    it("shows scroll-to-bottom button when scrolled up and hides it when clicked", () => {
      const messages: ChatMessage[] = [
        { id: "1", role: "user", content: "Message 1" },
        { id: "2", role: "agent", content: "Message 2" },
      ]

      act(() => {
        root?.render(
          createElement(ChatMessages, {
            messages,
          }),
        )
      })

      const viewport = container?.querySelector(
        '[data-slot="scroll-area-viewport"]',
      ) as HTMLDivElement
      expect(viewport).toBeDefined()

      // Mock scroll dimensions where user is scrolled up far from bottom:
      // distanceFromBottom = 1000 - 100 - 300 = 600 > 80 threshold
      Object.defineProperty(viewport, "scrollHeight", {
        value: 1000,
        configurable: true,
      })
      Object.defineProperty(viewport, "clientHeight", {
        value: 300,
        configurable: true,
      })
      Object.defineProperty(viewport, "scrollTop", {
        value: 100,
        configurable: true,
        writable: true,
      })
      viewport.scrollTo = mock((options?: ScrollToOptions | number) => {
        if (typeof options === "object" && options?.top !== undefined) {
          viewport.scrollTop = options.top
        } else if (typeof options === "number") {
          viewport.scrollTop = options
        }
      }) as unknown as typeof viewport.scrollTo

      // Trigger scroll event
      act(() => {
        viewport.dispatchEvent(new Event("scroll"))
      })

      const scrollBottomBtn = container?.querySelector(
        'button[aria-label="Scroll to latest messages"]',
      ) as HTMLButtonElement
      expect(scrollBottomBtn).toBeDefined()
      expect(scrollBottomBtn?.textContent).toContain("Scroll to bottom")

      // Clicking scroll to bottom
      act(() => {
        scrollBottomBtn.click()
      })

      expect(viewport.scrollTop).toBe(1000)
      expect(
        container?.querySelector(
          'button[aria-label="Scroll to latest messages"]',
        ),
      ).toBeNull()
    })

    it("does not force scroll to bottom during streaming when user has scrolled up", () => {
      const messages: ChatMessage[] = [
        { id: "1", role: "user", content: "Message 1" },
        {
          id: "2",
          role: "agent",
          content: "Token 1",
          status: "streaming",
        },
      ]

      act(() => {
        root?.render(
          createElement(ChatMessages, {
            messages,
          }),
        )
      })

      const viewport = container?.querySelector(
        '[data-slot="scroll-area-viewport"]',
      ) as HTMLDivElement
      expect(viewport).toBeDefined()

      // User scrolls up
      Object.defineProperty(viewport, "scrollHeight", {
        value: 1200,
        configurable: true,
      })
      Object.defineProperty(viewport, "clientHeight", {
        value: 300,
        configurable: true,
      })
      Object.defineProperty(viewport, "scrollTop", {
        value: 200,
        configurable: true,
        writable: true,
      })

      act(() => {
        viewport.dispatchEvent(new Event("scroll"))
      })

      // Simulate next streaming token arriving in-place
      const updatedMessages: ChatMessage[] = [
        { id: "1", role: "user", content: "Message 1" },
        {
          id: "2",
          role: "agent",
          content: "Token 1 Token 2",
          status: "streaming",
        },
      ]

      act(() => {
        root?.render(
          createElement(ChatMessages, {
            messages: updatedMessages,
          }),
        )
      })

      // Viewport scrollTop should remain untouched at 200 (not pushed to bottom)
      expect(viewport.scrollTop).toBe(200)
    })

    it("renders each message exactly once and never duplicates completed agent responses", () => {
      const messages: ChatMessage[] = [
        { id: "1", role: "user", content: "Unique User Query" },
        {
          id: "2",
          role: "agent",
          content: "Unique Agent Response",
          status: "completed",
        },
      ]

      act(() => {
        root?.render(
          createElement(ChatMessages, {
            messages,
          }),
        )
      })

      const text = container?.textContent ?? ""
      const matches = text.match(/Unique Agent Response/g)
      expect(matches).toHaveLength(1)
    })
  })

  describe("ChatContainer", () => {
    it("renders header, message feed, and composer inside query provider", () => {
      act(() => {
        root?.render(
          createElement(
            QueryClientProvider,
            { client: queryClient },
            createElement(ChatContainer, {}),
          ),
        )
      })

      expect(container?.textContent).toContain("Nabu Agent Chat")
      expect(container?.textContent).toContain("Online")
      expect(container?.querySelector("textarea")).toBeDefined()
    })

    it("starts with composer centered and transitions to bottom when message is sent", async () => {
      act(() => {
        root?.render(
          createElement(
            QueryClientProvider,
            { client: queryClient },
            createElement(ChatContainer, {}),
          ),
        )
      })

      const composerLayer = container?.querySelector(
        '[data-slot="composer-container"]',
      )
      expect(composerLayer?.className).toContain("bottom-1/2")
      expect(composerLayer?.className).toContain("translate-y-1/2")

      const heroGreeting = container?.querySelector(
        '[data-slot="hero-greeting"]',
      )
      expect(heroGreeting?.className).toContain("opacity-100")
      expect(heroGreeting?.textContent).toContain(
        "How can Nabu assist you today?",
      )

      const textarea = container?.querySelector(
        "textarea",
      ) as HTMLTextAreaElement
      expect(textarea).toBeDefined()

      act(() => {
        setNativeValue(textarea, "What is my ledger balance?")
      })

      const submitBtn = container?.querySelector(
        'button[type="submit"]',
      ) as HTMLButtonElement
      await act(async () => {
        submitBtn?.click()
      })

      // Composer should now have bottom-0 and translate-y-0
      expect(composerLayer?.className).toContain("bottom-0")
      expect(composerLayer?.className).toContain("translate-y-0")
      expect(heroGreeting?.className).toContain("opacity-0")
      expect(container?.textContent).toContain("What is my ledger balance?")

      // Clear conversation button should now be available
      const clearBtn = Array.from(
        container?.querySelectorAll("button") ?? [],
      ).find((b) => b.textContent?.includes("Clear conversation"))
      expect(clearBtn).toBeDefined()

      await act(async () => {
        clearBtn?.click()
      })

      // Should reset back to centered state
      expect(composerLayer?.className).toContain("bottom-1/2")
      expect(composerLayer?.className).toContain("translate-y-1/2")
      expect(heroGreeting?.className).toContain("opacity-100")
    })
  })
})
