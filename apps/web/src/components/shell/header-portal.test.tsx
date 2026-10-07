import { afterEach, beforeEach, describe, expect, it } from "bun:test"

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

const { act, createElement } = await import("react")
const { createRoot } = await import("react-dom/client")

const { HEADER_PORTAL_REGIONS } = await import(
  "@/lib/stores/header-portal.store"
)
const { useHeaderPortalStore } = await import(
  "@/lib/stores/header-portal.store"
)
const { HeaderPortal, HeaderPortalSlot } = await import("./header-portal")

/**
 * Stands in for the shell's top bar: one mounted region per slot, plus a body
 * area whose components claim those slots.
 */
function HeaderHarness({ children }: { readonly children?: React.ReactNode }) {
  return createElement(
    "div",
    null,
    createElement(
      "header",
      { "data-testid": "header" },
      createElement(HeaderPortalSlot, { region: "start", key: "start" }),
      createElement(HeaderPortalSlot, { region: "center", key: "center" }),
      createElement(HeaderPortalSlot, { region: "end", key: "end" }),
    ),
    createElement("main", { "data-testid": "page" }, children),
  )
}

function region(region: string): HTMLElement | null {
  const header = document.querySelector('[data-testid="header"]')
  return header?.querySelector(`[data-slot="header-portal-${region}"]`) ?? null
}

describe("header portal", () => {
  let container: HTMLDivElement | null = null
  let root: ReturnType<typeof createRoot> | null = null

  beforeEach(() => {
    useHeaderPortalStore.getState().retractAll()
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

  it("publishes every region's own node on mount", () => {
    act(() => {
      root?.render(createElement(HeaderHarness, {}))
    })

    const { targets } = useHeaderPortalStore.getState()
    for (const name of HEADER_PORTAL_REGIONS) {
      expect(targets[name]).toBe(region(name))
    }
  })

  it("renders injected content in the header, not in place", () => {
    act(() => {
      root?.render(
        createElement(
          HeaderHarness,
          {},
          createElement(HeaderPortal, {
            children: "Ledger reconciliation",
            region: "start",
          }),
        ),
      )
    })

    expect(region("start")?.textContent).toBe("Ledger reconciliation")
    // The page itself must not keep a copy: content that renders in both places
    // during hydration is the classic portal mistake.
    expect(
      document.querySelector('[data-testid="page"]')?.textContent,
    ).not.toContain("Ledger reconciliation")
  })

  it("keeps each region's content in its own slot", () => {
    act(() => {
      root?.render(
        createElement(
          HeaderHarness,
          {},
          createElement(HeaderPortal, { children: "Actions", region: "end" }),
          createElement(HeaderPortal, { children: "Title", region: "start" }),
          createElement(HeaderPortal, { children: "Middle", region: "center" }),
        ),
      )
    })

    expect(region("start")?.textContent).toBe("Title")
    expect(region("center")?.textContent).toBe("Middle")
    expect(region("end")?.textContent).toBe("Actions")
  })

  it("stacks several contributors in the same region", () => {
    act(() => {
      root?.render(
        createElement(
          HeaderHarness,
          {},
          createElement(HeaderPortal, { children: "New chat", region: "end" }),
          createElement(HeaderPortal, { children: "Export", region: "end" }),
        ),
      )
    })

    expect(region("end")?.textContent).toBe("New chatExport")
    expect(
      region("end")?.querySelectorAll('[data-slot="header-portal-content"]'),
    ).toHaveLength(2)
  })

  it("renders nothing in place while no region is mounted", () => {
    // The server's state, and the first client render before the shell's refs
    // attach. Injected content must be absent here, not duplicated.
    act(() => {
      root?.render(
        createElement(HeaderPortal, {
          children: "Ledger reconciliation",
          region: "start",
        }),
      )
    })

    expect(container?.textContent).toBe("")
  })

  it("removes a page's content when the page goes away", () => {
    function Page({ title }: { readonly title: string | null }) {
      return title === null
        ? null
        : createElement(HeaderPortal, { children: title, region: "start" })
    }

    act(() => {
      root?.render(
        createElement(HeaderHarness, {}, createElement(Page, { title: "Q3" })),
      )
    })
    expect(region("start")?.textContent).toBe("Q3")

    act(() => {
      root?.render(createElement(HeaderHarness, {}))
    })
    expect(region("start")?.textContent).toBe("")
  })

  it("drops a region's content when the header itself unmounts", () => {
    act(() => {
      root?.render(
        createElement(
          HeaderHarness,
          {},
          createElement(HeaderPortal, { children: "Q3", region: "start" }),
        ),
      )
    })

    act(() => {
      root?.render(
        createElement(
          "div",
          null,
          createElement(HeaderPortal, { children: "Q3", region: "start" }),
        ),
      )
    })

    expect(useHeaderPortalStore.getState().targets.start).toBeNull()
    expect(container?.textContent).toBe("")
  })

  it("applies the caller's className on top of the flex-item contract", () => {
    act(() => {
      root?.render(
        createElement(
          HeaderHarness,
          {},
          createElement(HeaderPortal, {
            children: "Q3",
            className: "truncate text-sm",
            region: "start",
          }),
        ),
      )
    })

    const wrapper = region("start")?.querySelector(
      '[data-slot="header-portal-content"]',
    ) as HTMLElement | null
    expect(wrapper?.className).toContain("min-w-0")
    expect(wrapper?.className).toContain("truncate")
  })
})
