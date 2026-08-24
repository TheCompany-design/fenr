/**
 * Floating app sidebar (rebuilt from the @blocks-so/sidebar-03 reference
 * per AGENTS.md — no copied block code, tokens only, hugeicons only).
 *
 * - `variant="floating"` gives the detached floating-navbar aesthetic.
 * - Collapses to icon rail on desktop (rail click toggles); sheet
 *   navigation on mobile via the SidebarTrigger in the shell's top bar —
 *   deliberately NOT here, because a trigger inside the closed mobile
 *   sheet could never reopen it.
 * - Active item is derived from TanStack Router state, never pathname
 *   string-parsing in components.
 */
import { RocketIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Link, useRouterState } from "@tanstack/react-router"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@workspace/ui/components/sidebar"

import type { NavItem } from "./nav-config"

import { NAV_ITEMS } from "./nav-config"

function Brand() {
  return (
    <Link
      aria-label="Fenr home"
      className="flex min-w-0 items-center gap-2"
      to="/"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
        <HugeiconsIcon icon={RocketIcon} size={18} />
      </span>
      <span className="truncate font-semibold text-lg group-data-[collapsible=icon]:hidden">
        Fenr
      </span>
    </Link>
  )
}

function NavItemButton({ item, active }: { item: NavItem; active: boolean }) {
  const { disabled, icon, title, to } = item

  if (disabled || !to) {
    return (
      <SidebarMenuButton
        aria-disabled="true"
        disabled
        title={`${title} — coming soon`}
      >
        <HugeiconsIcon icon={icon} size={16} />
        <span>{title}</span>
      </SidebarMenuButton>
    )
  }

  return (
    <SidebarMenuButton
      isActive={active}
      render={<Link activeOptions={{ exact: true }} to={to} />}
      tooltip={title}
    >
      <HugeiconsIcon icon={icon} size={16} />
      <span>{title}</span>
    </SidebarMenuButton>
  )
}

export function useActiveNavId(): string | null {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  for (const item of NAV_ITEMS) {
    if (!item.disabled && item.to !== undefined && pathname === item.to) {
      return item.id
    }
  }
  return null
}

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const activeId = useActiveNavId()

  return (
    <Sidebar collapsible="icon" variant="floating" {...props}>
      <SidebarHeader>
        <div className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center px-2 py-1.5">
          <Brand />
        </div>
      </SidebarHeader>
      {/* Nav list can overflow → ScrollArea per styling convention. */}
      <ScrollArea className="flex-1">
        <SidebarContent>
          <div className="flex flex-col gap-4 px-2 py-4">
            <nav aria-label="Main navigation">
              <SidebarMenu>
                {NAV_ITEMS.map((item) => (
                  <SidebarMenuItem key={item.id}>
                    <NavItemButton
                      active={!item.disabled && item.id === activeId}
                      item={item}
                    />
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </nav>
          </div>
        </SidebarContent>
      </ScrollArea>
      {/* Footer intentionally empty — team switcher / notifications dropped
			    per epic decision; slots available for future chrome. */}
      <SidebarRail />
    </Sidebar>
  )
}
