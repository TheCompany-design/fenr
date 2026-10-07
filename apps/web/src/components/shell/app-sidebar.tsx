/**
 * Floating app sidebar with smooth spring animations.
 *
 * - `variant="floating"` gives the detached floating-card aesthetic.
 * - Morphing spring animations for desktop expand/collapse.
 * - Sliding active item indicator with layoutId.
 * - Collapses to icon rail on desktop (rail click toggles); sheet
 *   navigation on mobile via the SidebarTrigger in the shell's top bar.
 * - Active item is derived from TanStack Router state, never pathname
 *   string-parsing in components.
 */
import { HugeiconsIcon } from "@hugeicons/react"
import { Link, useRouterState } from "@tanstack/react-router"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import {
  Sidebar,
  SidebarCollapsibleLabel,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@workspace/ui/components/sidebar"
import {
  type ActiveOrganization,
  OrganizationSwitcher,
} from "@/features/organizations"
import type { NavItem } from "./nav-config"
import { NAV_ITEMS } from "./nav-config"

function NavItemButton({ item, active }: { item: NavItem; active: boolean }) {
  const { disabled, icon, title, to } = item

  const content = (
    <>
      <div className="relative z-10 flex size-10 shrink-0 items-center justify-center">
        <HugeiconsIcon icon={icon} size={18} />
      </div>
      <SidebarCollapsibleLabel className="relative z-10 grow pl-2 text-sm font-medium">
        {title}
      </SidebarCollapsibleLabel>
    </>
  )

  if (disabled || !to) {
    // No `disabled`/`aria-disabled` pointer-events blocking: a disabled
    // button never receives hover, so its tooltip could never show. The
    // item is inert by construction (no onClick, no route).
    return (
      <SidebarMenuButton
        aria-disabled="true"
        className="aria-disabled:pointer-events-auto"
        tabIndex={-1}
        tooltip={`${title} — coming soon`}
      >
        {content}
      </SidebarMenuButton>
    )
  }

  return (
    <SidebarMenuButton
      isActive={active}
      render={<Link activeOptions={{ exact: true }} to={to} />}
      tooltip={title}
    >
      {content}
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

export type AppSidebarProps = React.ComponentProps<typeof Sidebar>

export interface AppSidebarOwnProps {
  activeOrganization?: ActiveOrganization | null
}

export function AppSidebar({
  activeOrganization,
  ...props
}: AppSidebarProps & AppSidebarOwnProps) {
  const activeId = useActiveNavId()

  return (
    <Sidebar collapsible="icon" variant="floating" {...props}>
      <SidebarHeader>
        <OrganizationSwitcher activeOrganization={activeOrganization} />
      </SidebarHeader>
      {/* Nav list can overflow → ScrollArea per styling convention. */}
      <ScrollArea className="flex-1">
        <SidebarContent>
          <nav aria-label="Main navigation">
            <SidebarMenu className="gap-1">
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
        </SidebarContent>
      </ScrollArea>
      <SidebarRail />
    </Sidebar>
  )
}
