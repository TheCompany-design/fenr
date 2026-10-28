import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router"

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

const { act, createElement } = await import("react")
const { createRoot } = await import("react-dom/client")

// Mock server function for deletion
const mockDeleteChatThreadFn = mock(
  async (_args: { data: { threadId: string } }) => true,
)

const actualFunctions = await import("../chat.functions")
mock.module("../chat.functions", () => ({
  ...actualFunctions,
  deleteChatThreadFn: mockDeleteChatThreadFn,
}))

// Mock sonner toast
const mockToast = {
  success: mock((_msg: string, _opts?: unknown) => {}),
  error: mock((_msg: string, _opts?: unknown) => {}),
}
mock.module("sonner", () => ({
  toast: mockToast,
}))

// Mock confirm hook
let confirmResponse = true
const mockConfirm = mock(async () => confirmResponse)
mock.module("@/components/feedback/use-confirm", () => ({
  useConfirm: () => mockConfirm,
}))

const { useSecondarySidebarStore } = await import(
  "@/lib/stores/secondary-sidebar.store"
)
const { SecondarySidebarSlot } = await import(
  "@/components/shell/secondary-sidebar"
)
const { chatKeys } = await import("../queries/chat-queries")
const { ChatSidebar } = await import("./chat-sidebar")

import type { ChatThreadSummary } from "../types"

function setInputValue(el: HTMLInputElement, val: string) {
  const set = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set
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

describe("ChatSidebar Component", () => {
  let container: HTMLDivElement | null = null
  let root: ReturnType<typeof createRoot> | null = null
  let queryClient: QueryClient

  beforeEach(() => {
    confirmResponse = true
    mockConfirm.mockClear()
    mockDeleteChatThreadFn.mockClear()
    mockToast.success.mockClear()
    mockToast.error.mockClear()
    useSecondarySidebarStore.getState().reset()

    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })

    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => {
      root?.unmount()
    })
    container?.remove()
    container = null
    root = null
    useSecondarySidebarStore.getState().reset()
  })

  async function renderSidebar(
    threads: ChatThreadSummary[],
    activeThreadId?: string,
  ) {
    queryClient.setQueryData(chatKeys.threads(), threads)

    const rootRoute = createRootRoute({
      component: () =>
        createElement(
          QueryClientProvider,
          { client: queryClient },
          createElement(
            "div",
            null,
            createElement(SecondarySidebarSlot, null),
            createElement(ChatSidebar, { activeThreadId }),
          ),
        ),
    })

    const router = createRouter({
      routeTree: rootRoute,
      history: createMemoryHistory({ initialEntries: ["/chat"] }),
    })
    await router.load()

    await act(async () => {
      root?.render(createElement(RouterProvider, { router }))
    })

    return { router }
  }

  it("renders empty state when there are no threads", async () => {
    await renderSidebar([])

    expect(container?.textContent).toContain("No conversations yet")
    expect(container?.textContent).toContain(
      "Start a conversation to see your history here.",
    )
  })

  it("renders grouped threads by date", async () => {
    const now = new Date()
    const threads: ChatThreadSummary[] = [
      {
        id: "thread-today",
        title: "Today Discussion",
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
      {
        id: "thread-yesterday",
        title: "Yesterday Discussion",
        createdAt: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
      },
    ]

    await renderSidebar(threads, "thread-today")

    expect(container?.textContent).toContain("Today")
    expect(container?.textContent).toContain("Yesterday")
    expect(container?.textContent).toContain("Today Discussion")
    expect(container?.textContent).toContain("Yesterday Discussion")

    // Active thread check
    const activeItem = container?.querySelector('[data-active=""]')
    expect(activeItem).not.toBeNull()
    expect(activeItem?.textContent).toContain("Today Discussion")
  })

  it("filters threads when searching", async () => {
    const now = new Date()
    const threads: ChatThreadSummary[] = [
      {
        id: "thread-1",
        title: "Alpha Research",
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
      {
        id: "thread-2",
        title: "Beta Planning",
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
    ]

    await renderSidebar(threads)

    expect(container?.textContent).toContain("Alpha Research")
    expect(container?.textContent).toContain("Beta Planning")

    const searchInput = container?.querySelector(
      'input[type="text"], input:not([type])',
    ) as HTMLInputElement
    expect(searchInput).not.toBeNull()

    // Type query matching only Alpha
    await act(async () => {
      setInputValue(searchInput, "alpha")
    })

    expect(container?.textContent).toContain("Alpha Research")
    expect(container?.textContent).not.toContain("Beta Planning")

    // Type query matching neither
    await act(async () => {
      setInputValue(searchInput, "nonexistent")
    })

    expect(container?.textContent).toContain("No chats found")

    // Click "Clear search"
    const clearButton = Array.from(
      container?.querySelectorAll("button") ?? [],
    ).find((b) => b.textContent?.includes("Clear search"))
    expect(clearButton).toBeDefined()

    await act(async () => {
      clearButton?.click()
    })

    expect(container?.textContent).toContain("Alpha Research")
    expect(container?.textContent).toContain("Beta Planning")

    // Test the input clear icon button
    await act(async () => {
      setInputValue(searchInput, "alpha")
    })
    expect(container?.textContent).not.toContain("Beta Planning")

    const clearInputIconBtn = container?.querySelector(
      'button[aria-label="Clear search query"]',
    ) as HTMLButtonElement
    expect(clearInputIconBtn).not.toBeNull()

    await act(async () => {
      clearInputIconBtn.click()
    })
    expect(container?.textContent).toContain("Beta Planning")
  })

  it("handles deletion errors gracefully and shows error toast", async () => {
    const now = new Date()
    const threads: ChatThreadSummary[] = [
      {
        id: "thread-err-1",
        title: "Failing Conversation",
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
    ]

    await renderSidebar(threads, "thread-err-1")

    const deleteBtn = container?.querySelector(
      'button[aria-label="Delete Failing Conversation"]',
    ) as HTMLButtonElement

    confirmResponse = true
    mockDeleteChatThreadFn.mockImplementationOnce(async () => {
      throw new Error("Database network error")
    })

    await act(async () => {
      deleteBtn.click()
    })

    expect(mockToast.error).toHaveBeenCalledWith(
      "Failed to delete conversation",
      { description: "Database network error" },
    )
  })

  it("prompts for confirmation and deletes thread on user confirmation", async () => {
    const now = new Date()
    const threads: ChatThreadSummary[] = [
      {
        id: "thread-del-1",
        title: "Conversation to Delete",
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
    ]

    const { router } = await renderSidebar(threads, "thread-del-1")

    const deleteBtn = container?.querySelector(
      'button[aria-label="Delete Conversation to Delete"]',
    ) as HTMLButtonElement
    expect(deleteBtn).not.toBeNull()

    // First test cancellation: confirm returns false
    confirmResponse = false
    await act(async () => {
      deleteBtn.click()
    })

    expect(mockConfirm).toHaveBeenCalledTimes(1)
    expect(mockDeleteChatThreadFn).not.toHaveBeenCalled()

    // Now test confirmation: confirm returns true
    confirmResponse = true
    await act(async () => {
      deleteBtn.click()
    })

    expect(mockConfirm).toHaveBeenCalledTimes(2)
    expect(mockDeleteChatThreadFn).toHaveBeenCalledWith({
      data: { threadId: "thread-del-1" },
    })
    expect(mockToast.success).toHaveBeenCalledWith("Conversation deleted")
    expect(router.state.location.pathname).toBe("/chat")
  })
})
