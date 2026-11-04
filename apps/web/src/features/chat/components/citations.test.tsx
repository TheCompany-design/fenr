import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  Citation,
  type CitationItem,
  Citations,
} from "@workspace/ui/components/citations"
import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import { extractCitationsFromMarkdown } from "../lib/extract-citations"
import { groupIntoTurns } from "../state/chat-turns"
import type { ChatMessage } from "../types"
import { ChatTurnBlock } from "./chat-turn-block"

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

describe("beUI Citations Component & Integration", () => {
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
      } catch {}
      root = null
    }
    if (container?.parentNode) {
      container.parentNode.removeChild(container)
      container = null
    }
  })

  it("extracts markdown footnote definitions and reference citations", () => {
    const markdown = [
      "Here is claim one [1](#citation-turn-1) and claim two [2](#citation-turn-2).",
      "",
      '[1]: https://motion.dev/docs/react "Motion Docs"',
      '[2]: https://w3.org/WAI/ARIA/apg/ "WAI Guidelines"',
    ].join("\n")

    const extracted = extractCitationsFromMarkdown(markdown)
    expect(extracted.length).toBe(2)
    expect(extracted[0].id).toBe("1")
    expect(extracted[0].url).toBe("https://motion.dev/docs/react")
    expect(extracted[0].title).toBe("Motion Docs")
    expect(extracted[0].domain).toBe("motion.dev")

    expect(extracted[1].id).toBe("2")
    expect(extracted[1].url).toBe("https://w3.org/WAI/ARIA/apg/")
    expect(extracted[1].domain).toBe("w3.org")
  })

  it("renders standalone Citations disclosure and list", () => {
    const items: CitationItem[] = [
      {
        id: "source-1",
        title: "Vercel React Best Practices",
        domain: "vercel.com",
        url: "https://vercel.com/docs",
      },
      {
        id: "source-2",
        title: "TanStack Start Routing",
        domain: "tanstack.com",
        url: "https://tanstack.com/start",
      },
    ]

    act(() => {
      root?.render(
        createElement(Citations, {
          citations: items,
          idPrefix: "test-src",
          defaultOpen: true,
        }),
      )
    })

    const titleEl = container?.querySelector("button span.font-medium")
    expect(titleEl?.textContent).toBe("Sources")

    const countEl = container?.querySelector("button span.tabular-nums")
    expect(countEl?.textContent?.trim()).toBe("2")

    const links = container?.querySelectorAll("a[href]")
    expect(links?.length).toBe(2)
    expect(links?.[0]?.getAttribute("href")).toBe("https://vercel.com/docs")
    expect(links?.[0]?.textContent).toContain("Vercel React Best Practices")
    expect(links?.[1]?.getAttribute("href")).toBe("https://tanstack.com/start")
  })

  it("renders inline Citation badge linking to the citation target id", () => {
    act(() => {
      root?.render(
        createElement(Citation, {
          citationId: "doc-1",
          index: 1,
          idPrefix: "chat-preview",
        }),
      )
    })

    const badge = container?.querySelector("a")
    expect(badge).not.toBeNull()
    expect(badge?.getAttribute("href")).toBe("#chat-preview-doc-1")
    expect(badge?.textContent?.trim()).toBe("1")
  })

  it("renders inline citations and Citations accordion in ChatTurnBlock when agent message has citations", () => {
    const markdown = [
      "Ledger reconciliation complete [1](#citation-turn-1-1).",
      "",
      '[1]: https://financial-engine.com/reports "Q3 Reconciliation Report"',
    ].join("\n")

    const msg: ChatMessage = {
      id: "agent-turn-1",
      turnId: "turn-1",
      role: "agent",
      content: markdown,
    }

    const turn = groupIntoTurns([msg])[0]
    expect(turn).toBeDefined()
    if (!turn) return

    act(() => {
      root?.render(
        createElement(
          QueryClientProvider,
          { client: queryClient },
          createElement(ChatTurnBlock, { turn }),
        ),
      )
    })

    // Inline badge check
    const inlineCitation = container?.querySelector(
      'a[href="#citation-turn-1-1"]',
    )
    expect(inlineCitation).not.toBeNull()
    expect(inlineCitation?.textContent?.trim()).toBe("1")

    // Sources accordion check
    const sourcesBtn = container?.querySelector("button[aria-expanded]")
    expect(sourcesBtn).not.toBeNull()
    expect(sourcesBtn?.textContent).toContain("Sources")
    expect(sourcesBtn?.textContent).toContain("1")
  })
})
