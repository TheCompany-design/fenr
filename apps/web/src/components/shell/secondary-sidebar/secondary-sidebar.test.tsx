import { afterEach, beforeEach, describe, expect, it } from "bun:test"

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

const { act, createElement } = await import("react")
const { createRoot } = await import("react-dom/client")

const { useSecondarySidebarStore } = await import(
  "@/lib/stores/secondary-sidebar.store"
)
const {
  SecondarySidebarGroup,
  SecondarySidebarGroupLabel,
  SecondarySidebarHeader,
  SecondarySidebarItem,
  SecondarySidebarItemAction,
  SecondarySidebarPortal,
  SecondarySidebarRow,
  SecondarySidebarSlot,
  SecondarySidebarTrigger,
} = await import("./secondary-sidebar")

describe("SecondarySidebar Components", () => {
  let container: HTMLDivElement | null = null
  let root: ReturnType<typeof createRoot> | null = null

  beforeEach(() => {
    useSecondarySidebarStore.getState().reset()
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

  it("SecondarySidebarPortal registers hasContent on mount and cleans up on unmount", () => {
    expect(useSecondarySidebarStore.getState().hasContent).toBe(false)

    act(() => {
      root?.render(
        createElement(
          SecondarySidebarPortal,
          null,
          createElement("div", null, "Sidebar Content"),
        ),
      )
    })

    expect(useSecondarySidebarStore.getState().hasContent).toBe(true)

    act(() => {
      root?.render(createElement("div", null, "Empty"))
    })

    expect(useSecondarySidebarStore.getState().hasContent).toBe(false)
  })

  it("SecondarySidebarTrigger does not render when hasContent is false", () => {
    act(() => {
      root?.render(createElement(SecondarySidebarTrigger))
    })

    const button = container?.querySelector("button")
    expect(button).toBeNull()
    expect(container?.innerHTML).toBe("")
  })

  it("SecondarySidebarTrigger renders and toggles isOpen when hasContent is true", () => {
    useSecondarySidebarStore.getState().setHasContent(true)

    act(() => {
      root?.render(createElement(SecondarySidebarTrigger))
    })

    const button = container?.querySelector("button")
    expect(button).not.toBeNull()
    expect(useSecondarySidebarStore.getState().isOpen).toBe(true)

    act(() => {
      button?.click()
    })
    expect(useSecondarySidebarStore.getState().isOpen).toBe(false)

    act(() => {
      button?.click()
    })
    expect(useSecondarySidebarStore.getState().isOpen).toBe(true)
  })

  it("renders SecondarySidebarHeader with title and collapse button", () => {
    act(() => {
      root?.render(
        createElement(SecondarySidebarHeader, {
          title: "Test Panel",
          badge: createElement("span", { id: "test-badge" }, "v1"),
        }),
      )
    })

    expect(container?.textContent).toContain("Test Panel")
    expect(container?.querySelector("#test-badge")?.textContent).toBe("v1")

    const collapseBtn = container?.querySelector(
      'button[aria-label="Collapse panel"]',
    ) as HTMLButtonElement | null
    expect(collapseBtn).not.toBeNull()

    act(() => {
      collapseBtn?.click()
    })
    expect(useSecondarySidebarStore.getState().isOpen).toBe(false)
  })

  it("renders SecondarySidebarItem with active and inactive states", () => {
    act(() => {
      root?.render(
        createElement(SecondarySidebarItem, {
          label: "General Settings",
          isActive: false,
        }),
      )
    })

    let item = container?.querySelector(
      '[data-slot="secondary-sidebar-item"]',
    ) as HTMLElement | null
    expect(item?.hasAttribute("data-active")).toBe(false)
    expect(item?.textContent).toContain("General Settings")

    act(() => {
      root?.render(
        createElement(SecondarySidebarItem, {
          label: "General Settings",
          isActive: true,
        }),
      )
    })

    item = container?.querySelector(
      '[data-slot="secondary-sidebar-item"]',
    ) as HTMLElement | null
    expect(item?.hasAttribute("data-active")).toBe(true)
  })

  it("renders SecondarySidebarRow and SecondarySidebarItemAction", () => {
    act(() => {
      root?.render(
        createElement(
          SecondarySidebarRow,
          null,
          createElement(SecondarySidebarItem, { label: "Thread 1" }),
          createElement(SecondarySidebarItemAction, {
            "aria-label": "Options",
          }),
        ),
      )
    })

    expect(
      container?.querySelector('[data-slot="secondary-sidebar-row"]'),
    ).not.toBeNull()
    expect(
      container?.querySelector('[data-slot="secondary-sidebar-item-action"]'),
    ).not.toBeNull()
  })

  it("renders SecondarySidebarGroup and Label", () => {
    act(() => {
      root?.render(
        createElement(
          SecondarySidebarGroup,
          null,
          createElement(SecondarySidebarGroupLabel, null, "Recent"),
          createElement("div", null, "Item 1"),
        ),
      )
    })

    expect(container?.textContent).toContain("Recent")
    expect(container?.textContent).toContain("Item 1")
  })

  it("renders SecondarySidebarSlot and portals content into it", () => {
    useSecondarySidebarStore.getState().setHasContent(true)

    act(() => {
      root?.render(
        createElement(
          "div",
          null,
          createElement(SecondarySidebarSlot),
          createElement(
            SecondarySidebarPortal,
            null,
            createElement(
              "div",
              { id: "portaled-content" },
              "Hello from Portal",
            ),
          ),
        ),
      )
    })

    const portalRoot = container?.querySelector(
      '[data-slot="secondary-sidebar-portal-root"]',
    )
    expect(portalRoot).not.toBeNull()
    const content = container?.querySelector("#portaled-content")
    expect(content).not.toBeNull()
    expect(content?.textContent).toBe("Hello from Portal")
  })
})
