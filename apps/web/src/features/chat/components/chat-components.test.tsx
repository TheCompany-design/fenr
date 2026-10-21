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

const { ThinkingTrace } = await import("./thinking-trace")
const { ChatTurnBlock } = await import("./chat-turn-block")
const { groupIntoTurns } = await import("../state/chat-turns")
const { ChatMessages } = await import("./chat-messages")
const { ChatContainer } = await import("./chat-container")
const { usePromptStore } = await import("@/components/composer")

describe("Chat Components (Beautiful UI Adapted Primitives)", () => {
  let container: HTMLDivElement | null = null
  let root: ReturnType<typeof createRoot> | null = null
  let queryClient: QueryClient

  beforeEach(() => {
    usePromptStore.setState({
      text: "",
      mentions: [],
      attachments: [],
      selection: null,
      effort: null,
      toolIds: [],
      search: false,
      blockers: [{ kind: "no-model" }],
      notices: [],
      usage: null,
      hydrated: false,
      status: "ready",
      transport: null,
      runtimeTools: [],
    })
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
      } catch {}
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

      expect(container?.textContent).not.toContain(at.toISOString())
      expect(container?.textContent).toMatch(
        /^(Today|Yesterday|\w+day), \d{1,2} [A-Za-z]{3} \d{4} hrs$/,
      )

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

      act(() => {
        viewport.dispatchEvent(new window.Event("scroll"))
      })

      const scrollBottomBtn = container?.querySelector(
        'button[aria-label="Scroll to latest messages"]',
      ) as HTMLButtonElement
      expect(scrollBottomBtn).toBeDefined()
      expect(scrollBottomBtn?.textContent).toContain("Scroll to bottom")

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
        viewport.dispatchEvent(new window.Event("scroll"))
      })

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
    it("keeps the composer the only full-width layer over the conversation", () => {
      act(() => {
        root?.render(
          createElement(
            QueryClientProvider,
            { client: queryClient },
            createElement(ChatContainer, {}),
          ),
        )
      })

      const composer = container?.querySelector(
        '[data-slot="composer-container"]',
      )
      const textarea = container?.querySelector("textarea")

      expect(composer).not.toBeNull()
      expect(textarea).not.toBeNull()

      const fullWidthAbsolute = Array.from(
        container?.querySelectorAll("*") ?? [],
      ).filter((element) => {
        const className = (element as HTMLElement).className ?? ""
        return (
          typeof className === "string" &&
          className.includes("absolute") &&
          className.includes("inset-x-0")
        )
      })

      expect(fullWidthAbsolute).toHaveLength(1)
      expect(fullWidthAbsolute[0] as unknown as Node | undefined).toBe(
        composer as unknown as Node,
      )
    })

    it("renders message feed and composer inside query provider, with no header of its own", () => {
      act(() => {
        root?.render(
          createElement(
            QueryClientProvider,
            { client: queryClient },
            createElement(ChatContainer, {}),
          ),
        )
      })

      expect(container?.textContent).not.toContain("Nabu Agent Chat")
      expect(container?.textContent).not.toContain("Clear conversation")
      expect(container?.querySelector("header")).toBeNull()
      expect(container?.querySelector("textarea")).toBeDefined()
    })

    it("opens on a greeting and a question, with no icon above the input", () => {
      act(() => {
        root?.render(
          createElement(
            QueryClientProvider,
            { client: queryClient },
            createElement(ChatContainer, {}),
          ),
        )
      })

      const hero = container?.querySelector('[data-slot="hero-greeting"]')
      expect(hero?.textContent).toContain("Hi, I’m Nabu")
      expect(hero?.textContent).toContain("What are we working on today?")

      expect(hero?.querySelector("svg")).toBeNull()
      expect(hero?.querySelector("[data-slot]")).toBeNull()
    })

    it("names the send control for what it does", () => {
      act(() => {
        root?.render(
          createElement(
            QueryClientProvider,
            { client: queryClient },
            createElement(ChatContainer, {}),
          ),
        )
      })

      expect(
        container?.querySelector('button[aria-label="Send message"]'),
      ).not.toBeNull()

      expect(
        container?.querySelector('button[aria-label="Add files and tools"]'),
      ).not.toBeNull()
      expect(
        container?.querySelector('button[aria-label="Attach files"]'),
      ).toBeNull()
    })

    it("sends with a circular action in the input's corner", () => {
      act(() => {
        root?.render(
          createElement(
            QueryClientProvider,
            { client: queryClient },
            createElement(ChatContainer, {}),
          ),
        )
      })

      const send = container?.querySelector('button[aria-label="Send message"]')
      expect(send?.className).toContain("rounded-full")

      expect(send?.hasAttribute("disabled")).toBe(true)
    })

    it("docks the composer once the conversation has started", () => {
      act(() => {
        root?.render(
          createElement(
            QueryClientProvider,
            { client: queryClient },
            createElement(ChatContainer, {}),
          ),
        )
      })

      act(() => {
        queryClient.setQueryData(chatKeys.messages(null), [
          {
            id: "seed-1",
            role: "user",
            content: "What is my ledger balance?",
            status: "completed",
            createdAt: new Date().toISOString(),
          },
        ] satisfies ChatMessage[])
      })

      const composerLayer = container?.querySelector(
        '[data-slot="composer-container"]',
      )
      expect(composerLayer?.className).toContain("bottom-0")
      expect(composerLayer?.className).toContain("translate-y-0")

      const heroGreeting = container?.querySelector(
        '[data-slot="hero-greeting"]',
      )
      expect(heroGreeting?.className).toContain("opacity-0")
      expect(container?.textContent).toContain("What is my ledger balance?")
    })
  })
})
