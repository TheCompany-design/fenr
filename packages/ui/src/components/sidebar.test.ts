import { describe, expect, it } from "bun:test"
import type { Root } from "react-dom/client"
import * as AnimatedSidebar from "./animated-sidebar"
import * as Sidebar from "./sidebar"

describe("sidebar component exports and aliases", () => {
  it("exports all standard and animated sidebar components from sidebar.tsx", () => {
    expect(Sidebar.Sidebar).toBeDefined()
    expect(Sidebar.SidebarProvider).toBeDefined()
    expect(Sidebar.SidebarTrigger).toBeDefined()
    expect(Sidebar.SidebarRail).toBeDefined()
    expect(Sidebar.SidebarInset).toBeDefined()
    expect(Sidebar.SidebarHeader).toBeDefined()
    expect(Sidebar.SidebarFooter).toBeDefined()
    expect(Sidebar.SidebarContent).toBeDefined()
    expect(Sidebar.SidebarSeparator).toBeDefined()
    expect(Sidebar.SidebarInput).toBeDefined()
    expect(Sidebar.SidebarGroup).toBeDefined()
    expect(Sidebar.SidebarGroupLabel).toBeDefined()
    expect(Sidebar.SidebarGroupAction).toBeDefined()
    expect(Sidebar.SidebarGroupContent).toBeDefined()
    expect(Sidebar.SidebarMenu).toBeDefined()
    expect(Sidebar.SidebarMenuItem).toBeDefined()
    expect(Sidebar.SidebarMenuButton).toBeDefined()
    expect(Sidebar.SidebarMenuAction).toBeDefined()
    expect(Sidebar.SidebarMenuBadge).toBeDefined()
    expect(Sidebar.SidebarMenuSkeleton).toBeDefined()
    expect(Sidebar.SidebarMenuSub).toBeDefined()
    expect(Sidebar.SidebarMenuSubItem).toBeDefined()
    expect(Sidebar.SidebarMenuSubButton).toBeDefined()
    expect(Sidebar.useSidebar).toBeDefined()
    expect(Sidebar.useSidebarPanel).toBeDefined()
    expect(Sidebar.useIsMobile).toBeDefined()
  })

  it("exports matching animated aliases from animated-sidebar.tsx", () => {
    expect(AnimatedSidebar.AnimatedSidebar).toBe(Sidebar.Sidebar)
    expect(AnimatedSidebar.AnimatedSidebarProvider).toBe(
      Sidebar.SidebarProvider,
    )
    expect(AnimatedSidebar.AnimatedSidebarTrigger).toBe(Sidebar.SidebarTrigger)
    expect(AnimatedSidebar.AnimatedSidebarMenu).toBe(Sidebar.SidebarMenu)
    expect(AnimatedSidebar.AnimatedSidebarMenuButton).toBe(
      Sidebar.SidebarMenuButton,
    )
    expect(AnimatedSidebar.useAnimatedSidebar).toBe(Sidebar.useSidebar)
    expect(AnimatedSidebar.useAnimatedSidebarPanel).toBe(
      Sidebar.useSidebarPanel,
    )
  })
})

describe("desktop sidebar unified layout structure", () => {
  it("renders a single in-flow aside element without a decoupled sidebar-gap spacer", async () => {
    const React = await import("react")
    const { renderToStaticMarkup } = await import("react-dom/server")

    const html = renderToStaticMarkup(
      React.createElement(
        Sidebar.SidebarProvider,
        { defaultOpen: true },
        React.createElement(
          Sidebar.Sidebar,
          { variant: "floating" },
          React.createElement("div", null, "Sidebar Item"),
        ),
        React.createElement(
          Sidebar.SidebarInset,
          null,
          React.createElement("div", null, "Main Content"),
        ),
      ),
    )

    expect(html).not.toContain('data-slot="sidebar-gap"')
    expect(html).toContain('data-slot="sidebar"')
    expect(html).toContain('data-slot="sidebar-container"')
    expect(html).toContain('data-slot="sidebar-inner"')
    expect(html).toContain('data-slot="sidebar-inset"')

    expect(html).toContain("sticky top-0")
    expect(html).toContain("shrink-0")
    expect(html).not.toContain("fixed inset-y-0")
  })

  it("applies floating appearance as an inner visual treatment", async () => {
    const React = await import("react")
    const { renderToStaticMarkup } = await import("react-dom/server")

    const html = renderToStaticMarkup(
      React.createElement(
        Sidebar.SidebarProvider,
        { defaultOpen: true },
        React.createElement(
          Sidebar.Sidebar,
          { variant: "floating" },
          React.createElement("div", null, "Sidebar Item"),
        ),
      ),
    )

    expect(html).toContain("p-2")
    expect(html).toContain("rounded-2xl")
    expect(html).toContain("border")
    expect(html).toContain("shadow-xs")
  })

  it("handles collapsed state without creating a secondary gap element", async () => {
    const React = await import("react")
    const { renderToStaticMarkup } = await import("react-dom/server")

    const html = renderToStaticMarkup(
      React.createElement(
        Sidebar.SidebarProvider,
        { defaultOpen: false },
        React.createElement(
          Sidebar.Sidebar,
          { collapsible: "icon" },
          React.createElement("div", null, "Collapsed Item"),
        ),
      ),
    )

    expect(html).not.toContain('data-slot="sidebar-gap"')
    expect(html).toContain('data-state="collapsed"')
    expect(html).toContain('data-collapsible="icon"')
  })
})

describe("collapsed pill panel and circular item highlights", () => {
  // Renders a floating sidebar with one active menu item so the assertions
  // can see the panel, the item button, and the selected highlight at once.
  const renderFloatingWithActiveItem = async (open: boolean) => {
    const React = await import("react")
    const { renderToStaticMarkup } = await import("react-dom/server")

    return renderToStaticMarkup(
      React.createElement(
        Sidebar.SidebarProvider,
        { defaultOpen: open },
        React.createElement(
          Sidebar.Sidebar,
          { variant: "floating", collapsible: "icon" },
          React.createElement(
            Sidebar.SidebarContent,
            null,
            React.createElement(
              Sidebar.SidebarMenu,
              null,
              React.createElement(
                Sidebar.SidebarMenuItem,
                null,
                React.createElement(
                  Sidebar.SidebarMenuButton,
                  { isActive: true },
                  React.createElement(
                    "div",
                    {
                      className:
                        "relative z-10 flex size-10 shrink-0 items-center justify-center",
                    },
                    "icon",
                  ),
                  React.createElement(
                    Sidebar.SidebarCollapsibleLabel,
                    {
                      className: "relative z-10 grow pl-2 text-sm font-medium",
                    },
                    "Dashboard",
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    )
  }

  const menuButtonTag = (html: string) =>
    html.match(/<button[^>]*data-slot="sidebar-menu-button"[^>]*>/)?.[0] ?? ""

  const activeHighlightTag = (html: string) =>
    html.match(/<span class="absolute inset-0 z-0[^"]*"[^>]*>/)?.[0] ?? ""

  it("collapses the floating panel into a stadium with perfect semicircle tips", async () => {
    const html = await renderFloatingWithActiveItem(false)

    // Pill radius: (4.5rem icon width − 2 × 0.5rem container padding) ÷ 2.
    // Anything smaller leaves a straight segment before the curve.
    expect(html).toContain("border-radius:1.75rem")
  })

  it("renders collapsed items and their selected highlight as perfect circles", async () => {
    const html = await renderFloatingWithActiveItem(false)

    expect(menuButtonTag(html)).toContain("rounded-full")
    expect(menuButtonTag(html)).not.toContain("rounded-xl")
    // The row is squared (fixed 40×40, centered) so the circle is perfect even
    // though the rail's content slot is 38px after the panel's 1px borders.
    expect(menuButtonTag(html)).toContain("w-10")
    expect(menuButtonTag(html)).toContain("mx-auto")
    expect(activeHighlightTag(html)).toContain("rounded-full")
    expect(activeHighlightTag(html)).not.toContain("rounded-xl")
  })

  it("keeps the expanded floating panel rectangular with 2xl corners", async () => {
    const html = await renderFloatingWithActiveItem(true)

    // The expanded radius tracks the theme's `--radius-2xl` token (the same
    // value the `rounded-2xl` class resolves to) so the resting panel is
    // byte-identical to the pre-animation appearance.
    expect(html).toContain("border-radius:var(--radius-2xl)")
  })

  it("keeps expanded items and their selected highlight as rounded rects", async () => {
    const html = await renderFloatingWithActiveItem(true)

    expect(menuButtonTag(html)).toContain("rounded-xl")
    expect(menuButtonTag(html)).not.toContain("rounded-full")
    expect(activeHighlightTag(html)).toContain("rounded-xl")
    expect(activeHighlightTag(html)).not.toContain("rounded-full")
  })

  it("leaves inset and bordered variants without any animated radius", async () => {
    const React = await import("react")
    const { renderToStaticMarkup } = await import("react-dom/server")

    for (const variant of ["inset", "sidebar"] as const) {
      const html = renderToStaticMarkup(
        React.createElement(
          Sidebar.SidebarProvider,
          { defaultOpen: false },
          React.createElement(
            Sidebar.Sidebar,
            { variant, collapsible: "icon" },
            React.createElement("div", null, "Sidebar Item"),
          ),
        ),
      )

      expect(html).not.toContain("border-radius:")
    }
  })
})

describe("hover glider shape per sidebar state", () => {
  const mountSidebar = async (open: boolean) => {
    const React = await import("react")
    const { act } = await import("react")
    const { createRoot } = await import("react-dom/client")

    const container = document.createElement("div")
    document.body.appendChild(container)
    const root: Root = createRoot(container)

    await act(async () => {
      root.render(
        React.createElement(
          Sidebar.SidebarProvider,
          { defaultOpen: open },
          React.createElement(
            Sidebar.Sidebar,
            { variant: "floating", collapsible: "icon" },
            React.createElement(
              Sidebar.SidebarContent,
              null,
              React.createElement(
                Sidebar.SidebarMenu,
                null,
                React.createElement(
                  Sidebar.SidebarMenuItem,
                  null,
                  React.createElement(
                    Sidebar.SidebarMenuButton,
                    null,
                    React.createElement("span", null, "Nav item"),
                  ),
                ),
              ),
            ),
          ),
        ),
      )
    })

    return { container, root }
  }

  const hoverGliderPill = (container: HTMLElement) => {
    const pills = Array.from(
      container.querySelectorAll<HTMLElement>(".bg-sidebar-accent\\/50"),
    )
    return pills[0] ?? null
  }

  const hoverItem = async (container: HTMLElement) => {
    const { act } = await import("react")
    const item = container.querySelector<HTMLElement>(
      '[data-slot="sidebar-menu-item"]',
    )
    if (!item) throw new Error("sidebar menu item not found in mounted tree")

    await act(async () => {
      item.dispatchEvent(
        new MouseEvent("mouseover", { bubbles: true, cancelable: true }),
      )
      item.dispatchEvent(new MouseEvent("mouseenter", { bubbles: false }))
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
  }

  it("hovers as a perfect circle over the item box when collapsed", async () => {
    const { container, root } = await mountSidebar(false)

    try {
      await hoverItem(container)

      const pill = hoverGliderPill(container)
      expect(pill).not.toBeNull()
      expect(pill?.className).toContain("rounded-full")
      expect(pill?.className).not.toContain("rounded-xl")
      // No `inset-y-0.5` gap: the glider fills the row's exact box, which is
      // what makes it a perfect circle rather than a 40×38 almost-circle.
      expect(pill?.parentElement?.className).not.toContain("inset-y-0.5")
      // The container compensates for the 1px panel borders on each side so
      // it covers the row's full 40px width, matching the squared button.
      expect(pill?.parentElement?.getAttribute("style")).toContain("left: -1px")
      expect(pill?.parentElement?.getAttribute("style")).toContain(
        "right: -1px",
      )
    } finally {
      const { act } = await import("react")
      await act(async () => {
        root.unmount()
      })
      container.remove()
    }
  })

  it("keeps the expanded hover squircle and vertical inset", async () => {
    const { container, root } = await mountSidebar(true)

    try {
      await hoverItem(container)

      const pill = hoverGliderPill(container)
      expect(pill).not.toBeNull()
      expect(pill?.className).toContain("rounded-xl")
      expect(pill?.className).not.toContain("rounded-full")
      expect(pill?.parentElement?.className).toContain("inset-y-0.5")
      expect(pill?.parentElement?.getAttribute("style")).not.toContain(
        "left: -1px",
      )
    } finally {
      const { act } = await import("react")
      await act(async () => {
        root.unmount()
      })
      container.remove()
    }
  })
})
