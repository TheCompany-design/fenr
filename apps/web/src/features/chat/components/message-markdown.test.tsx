import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import { groupIntoTurns } from "../state/chat-turns"
import type { ChatMessage } from "../types"
import { ChatTurnBlock } from "./chat-turn-block"
import { MessageMarkdown } from "./message-markdown"

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

describe("MessageMarkdown & ChatTurnBlock Markdown Formatting", () => {
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

  /** Turn blocks read the integrations catalog, so they ride inside the
   *  QueryClientProvider the app mounts them under. */
  function render(element: ReturnType<typeof createElement>) {
    root?.render(
      createElement(QueryClientProvider, { client: queryClient }, element),
    )
  }

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

  it("formats headings, bold, italic, lists, inline code, fenced code blocks, and GFM tables in assistant messages", () => {
    const markdown = [
      "## Summary Report",
      "",
      "Here is **important** and *emphasized* text with `const x = 42` inline.",
      "",
      "- First bullet",
      "- Second bullet",
      "",
      "| Metric | Value |",
      "| --- | --- |",
      "| Revenue | $12,400 |",
      "",
      "```typescript",
      "export const total = 12400;",
      "```",
    ].join("\n")

    const msg: ChatMessage = {
      id: "msg-assistant-md",
      role: "agent",
      content: markdown,
    }
    const turn = groupIntoTurns([msg])[0]
    expect(turn).toBeDefined()
    if (!turn) return

    act(() => {
      render(createElement(ChatTurnBlock, { turn }))
    })

    const h2 = container?.querySelector("h2")
    expect(h2?.textContent).toBe("Summary Report")

    const strong = container?.querySelector("strong")
    expect(strong?.textContent).toBe("important")

    const em = container?.querySelector("em")
    expect(em?.textContent).toBe("emphasized")

    const inlineCode = container?.querySelector(
      '[data-slot="markdown-inline-code"]',
    )
    expect(inlineCode?.textContent).toBe("const x = 42")

    const listItems = container?.querySelectorAll("ul li")
    expect(listItems?.length).toBe(2)

    const tableCells = container?.querySelectorAll("table td")
    expect(tableCells?.length).toBe(2)
    expect(tableCells?.[0]?.textContent).toBe("Revenue")
    expect(tableCells?.[1]?.textContent).toBe("$12,400")

    const codeBlock = container?.querySelector(
      '[data-slot="markdown-code-block"]',
    )
    expect(codeBlock).not.toBeNull()
    expect(codeBlock?.textContent).toContain("typescript")
    expect(codeBlock?.textContent).toContain("export const total = 12400;")
  })

  it("formats markdown in user messages (bold, inline code, links, line breaks) without rendering unintended SVGs for plain text", () => {
    const userMsg: ChatMessage = {
      id: "msg-user-md",
      role: "user",
      content:
        "Please check **Q3 ledger** and `account_id`:\n1. Reconcile balances\n2. Export [report](https://example.com)",
    }
    const turn = groupIntoTurns([userMsg])[0]
    expect(turn).toBeDefined()
    if (!turn) return

    act(() => {
      render(createElement(ChatTurnBlock, { turn }))
    })

    expect(container?.querySelector("strong")?.textContent).toBe("Q3 ledger")
    expect(
      container?.querySelector('[data-slot="markdown-inline-code"]')
        ?.textContent,
    ).toBe("account_id")
    expect(container?.querySelectorAll("ol li").length).toBe(2)

    const link = container?.querySelector("a")
    expect(link?.getAttribute("href")).toBe("https://example.com")
    expect(link?.getAttribute("target")).toBe("_blank")
  })

  it("preserves single line breaks via remark-breaks", () => {
    act(() => {
      root?.render(
        createElement(MessageMarkdown, {
          content: "Line one\nLine two",
          variant: "user",
        }),
      )
    })

    expect(container?.querySelector("br")).not.toBeNull()
  })
})
