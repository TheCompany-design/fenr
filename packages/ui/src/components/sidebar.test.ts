import { describe, expect, it } from "bun:test"
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

    // Layout footprint is owned by <aside>, not a separate phantom gap
    expect(html).not.toContain('data-slot="sidebar-gap"')
    expect(html).toContain('data-slot="sidebar"')
    expect(html).toContain('data-slot="sidebar-container"')
    expect(html).toContain('data-slot="sidebar-inner"')
    expect(html).toContain('data-slot="sidebar-inset"')

    // Aside is in document flow (sticky top-0, shrink-0) and not fixed out-of-flow
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

    // The inner container houses the floating card visuals
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
