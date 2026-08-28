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
  useSidebar,
} from "@workspace/ui/components/sidebar"
import {
  LABEL_ENTER_TRANSITION,
  LABEL_EXIT_TRANSITION,
  REDUCED_TRANSITION,
} from "@workspace/ui/lib/ease"
import { cn } from "@workspace/ui/lib/utils"
import { motion, useReducedMotion } from "motion/react"
import type { NavItem } from "./nav-config"
import { NAV_ITEMS } from "./nav-config"
import type { SessionUser } from "./user-menu"

function Brand() {
  const { state, isMobile } = useSidebar()
  const reduce = useReducedMotion() ?? false
  const collapsed = state === "collapsed" && !isMobile

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          render={<Link aria-label="Fenr home" to="/" />}
          size="lg"
          tooltip="Fenr"
        >
          <div className="relative z-10 flex size-10 shrink-0 items-center justify-center">
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground shadow-xs">
              <HugeiconsIcon icon={RocketIcon} size={18} />
            </div>
          </div>
          <motion.span
            initial={false}
            animate={{
              opacity: collapsed ? 0 : 1,
              x: collapsed ? -8 : 0,
            }}
            transition={
              reduce
                ? REDUCED_TRANSITION
                : collapsed
                  ? LABEL_EXIT_TRANSITION
                  : LABEL_ENTER_TRANSITION
            }
            aria-hidden={collapsed}
            className={cn(
              "relative z-10 min-w-0 flex-1 overflow-hidden whitespace-nowrap font-semibold text-lg leading-none pl-2.5",
              collapsed && "pointer-events-none",
            )}
          >
            Fenr
          </motion.span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

function NavItemButton({ item, active }: { item: NavItem; active: boolean }) {
  const { disabled, icon, title, to } = item
  const { state, isMobile } = useSidebar()
  const reduce = useReducedMotion() ?? false
  const collapsed = state === "collapsed" && !isMobile

  const content = (
    <>
      <div className="relative z-10 flex size-10 shrink-0 items-center justify-center">
        <HugeiconsIcon icon={icon} size={18} />
      </div>
      <motion.span
        initial={false}
        animate={{
          opacity: collapsed ? 0 : 1,
          x: collapsed ? -8 : 0,
        }}
        transition={
          reduce
            ? REDUCED_TRANSITION
            : collapsed
              ? LABEL_EXIT_TRANSITION
              : LABEL_ENTER_TRANSITION
        }
        aria-hidden={collapsed}
        className={cn(
          "relative z-10 min-w-0 flex-1 overflow-hidden whitespace-nowrap pl-2 text-sm font-medium",
          collapsed && "pointer-events-none",
        )}
      >
        {title}
      </motion.span>
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

export interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  user?: SessionUser | null
}

export function AppSidebar({ user, ...props }: AppSidebarProps) {
  const activeId = useActiveNavId()

  return (
    <Sidebar collapsible="icon" variant="floating" {...props}>
      <SidebarHeader>
        <Brand />
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
