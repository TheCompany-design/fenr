import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

const { act, createElement } = await import("react")
const { createRoot } = await import("react-dom/client")

const { HeaderPortalSlot } = await import("@/components/shell/header-portal")
const { useHeaderPortalStore } = await import(
  "@/lib/stores/header-portal.store"
)
const { chatKeys } = await import("../queries/chat-queries")
const { ChatContainer } = await import("./chat-container")
const { ChatHeaderTitle } = await import("./chat-header-title")
const { usePromptStore } = await import("@/components/composer")

const THREAD_ID = "0f5c2f9e-4b6d-4c2e-9a1f-2b7d6e5c4a31"

function userMessage(content: string) {
  return {
    id: "user-1",
    role: "user" as const,
    content,
    status: "completed" as const,
  }
}

/** A shell top bar with one region, plus the page beneath it. */
function Shell({ children }: { readonly children?: React.ReactNode }) {
  return createElement(
    "div",
    null,
    createElement(
      "header",
      { "data-testid": "header" },
      createElement(HeaderPortalSlot, { region: "start" }),
      createElement(HeaderPortalSlot, { region: "end" }),
    ),
    createElement("main", null, children),
  )
}

function headerText(): string {
  const header = document.querySelector('[data-testid="header"]')
  // Excludes screen-reader-only text: what a person can actually see in the bar
  // is the question these assertions are asking.
  return Array.from(header?.querySelectorAll("*:not(.sr-only)") ?? [])
    .filter((node) => node.children.length === 0)
    .map((node) => node.textContent ?? "")
    .join("")
    .trim()
}

describe("chat header title", () => {
  let container: HTMLDivElement | null = null
  let root: ReturnType<typeof createRoot> | null = null
  let queryClient: QueryClient

  beforeEach(() => {
    useHeaderPortalStore.getState().retractAll()
    // The composer is module state that outlives any mount — one composer per
    // tab is the design — so a suite that renders ChatContainer must start it
    // from a clean slate or the previous test's draft text leaks into the DOM.
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
    act(() => {
      root?.unmount()
    })
    root = null
    container?.remove()
    container = null
  })

  function render(element: React.ReactElement) {
    act(() => {
      root?.render(
        createElement(
          QueryClientProvider,
          { client: queryClient },
          createElement(Shell, {}, element),
        ),
      )
    })
  }

  it("shows no title in the bar on a clean chat, but still names the page", () => {
    render(createElement(ChatContainer, {}))

    // Nothing a person can read as a title in the bar. The bar also carries the
    // conversation's provider picker now, so the region is not empty — the
    // title is what must be absent.
    expect(headerText()).not.toContain("New conversation")

    // ...and exactly one heading on the page, so the document outline is not
    // the unnamed empty heading a screen reader has to announce as blank.
    const heading = document.querySelector("h1") as HTMLElement | null
    expect(heading?.className).toContain("sr-only")
    expect(heading?.textContent).toBe("New conversation")
    expect(document.querySelectorAll("h1")).toHaveLength(1)
  })

  it("takes the chat's header away entirely", () => {
    render(createElement(ChatContainer, {}))

    const page = container?.querySelector("main")
    expect(container?.textContent).not.toContain("Nabu Agent Chat")
    expect(container?.textContent).not.toContain("Clear conversation")
    expect(page?.querySelector("header")).toBeNull()
    // The conversation itself is untouched.
    expect(page?.querySelector("textarea")).not.toBeNull()
  })

  it("names the thread in the shell header from an existing transcript", () => {
    queryClient.setQueryData(chatKeys.messages(THREAD_ID), [
      userMessage("Reconcile the Q3 ledger"),
      { id: "agent-1", role: "agent", content: "On it.", status: "completed" },
    ])

    render(createElement(ChatContainer, { threadId: THREAD_ID }))

    expect(headerText()).toContain("Reconcile the Q3 ledger")
  })

  it("fills the header in as soon as the first prompt is sent", () => {
    render(createElement(ChatContainer, {}))
    expect(headerText()).not.toContain("New conversation")

    // The transport's first act on send is to land the optimistic user
    // message in the draft cache. The title must fill in at that moment —
    // before the stream answers — which is exactly what writing the draft
    // does here.
    act(() => {
      queryClient.setQueryData(chatKeys.messages(null), [
        userMessage("Reconcile the Q3 ledger"),
      ])
    })

    expect(headerText()).toContain("Reconcile the Q3 ledger")
  })

  it("survives the hop from a draft chat to its persisted thread", () => {
    render(createElement(ChatContainer, {}))

    // What the stream does when the runtime mints the thread id: move the
    // optimistic messages onto the thread's key, then navigate. The title must
    // read the same before and after, or it blinks on every first prompt.
    act(() => {
      queryClient.setQueryData(chatKeys.messages(null), [
        userMessage("Reconcile the Q3 ledger"),
      ])
    })
    const draft = queryClient.getQueryData(chatKeys.messages(null))
    queryClient.setQueryData(chatKeys.messages(THREAD_ID), draft)
    render(createElement(ChatContainer, { threadId: THREAD_ID }))

    expect(headerText()).toContain("Reconcile the Q3 ledger")
  })

  it("clears the header when the page stops contributing to it", () => {
    queryClient.setQueryData(chatKeys.messages(THREAD_ID), [
      userMessage("Reconcile the Q3 ledger"),
    ])
    render(createElement(ChatContainer, { threadId: THREAD_ID }))
    expect(headerText()).toContain("Reconcile the Q3 ledger")

    render(createElement(ChatHeaderTitle, {}))

    expect(headerText()).toBe("")
  })

  it("starts a fresh chat clean, dropping a draft a failed turn left behind", () => {
    // A failed turn keeps its messages so the person can read what went wrong.
    // Clicking Chat to start over must not reopen that conversation — and with
    // it, the title the header now draws from the draft.
    queryClient.setQueryData(chatKeys.messages(null), [
      userMessage("Reconcile the Q3 ledger"),
    ])

    render(createElement(ChatContainer, {}))

    expect(headerText()).not.toContain("New conversation")
    expect(document.body.textContent).not.toContain("Reconcile the Q3 ledger")
  })

  it("keeps a failed conversation readable instead of wiping it as it fails", () => {
    render(createElement(ChatContainer, {}))

    // The optimistic messages land, then the streaming flag drops back when the
    // request fails. Nothing may clear the conversation in that gap: this is the
    // one moment the person is reading the error.
    act(() => {
      queryClient.setQueryData(chatKeys.messages(null), [
        userMessage("Reconcile the Q3 ledger"),
      ])
    })
    act(() => {
      render(createElement(ChatContainer, {}))
    })

    expect(headerText()).toContain("Reconcile the Q3 ledger")
  })

  it("truncates a long title instead of stretching the bar", () => {
    queryClient.setQueryData(chatKeys.messages(THREAD_ID), [
      userMessage(
        "Reconcile every ledger entry for every tenant across the quarter and flag the mismatches",
      ),
    ])

    render(createElement(ChatContainer, { threadId: THREAD_ID }))

    const heading = document.querySelector("h1") as HTMLElement | null
    expect(heading?.className).toContain("truncate")
    expect(heading?.textContent?.endsWith("…")).toBe(true)
    // The full prompt stays reachable for anyone who wants it.
    expect(heading?.getAttribute("title")).toBe(heading?.textContent)
  })
})
