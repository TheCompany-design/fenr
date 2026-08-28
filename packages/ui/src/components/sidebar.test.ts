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
