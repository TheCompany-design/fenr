/**
 * AppShell — composition root for every authenticated screen.
 *
 * Wraps the floating sidebar with the inset content area and a slim top
 * bar (mobile nav trigger + active-section label). Route content arrives
 * via children (the <Outlet /> rendered by the _app guard layout),
 * so this component stays route-agnostic.
 */
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@workspace/ui/components/sidebar"
import { TooltipProvider } from "@workspace/ui/components/tooltip"

import { domAnimation, LazyMotion } from "motion/react"
import { ThemeToggle } from "@/components/shell/theme-toggle"
import { type SessionUser, UserMenu } from "@/components/shell/user-menu"

import { AppSidebar } from "./app-sidebar"

export function AppShell({
  children,
  user,
  defaultOpen = true,
}: {
  children: React.ReactNode
  user: SessionUser
  /** Initial sidebar state, restored from the sidebar_state cookie on SSR. */
  defaultOpen?: boolean
}) {
  return (
    // delay={0}: Base UI tooltips default to a 600ms open delay — nav
    // tooltips should feel instant. The provider also makes moving between
    // adjacent triggers switch tooltips instantly (delay group).
    <LazyMotion features={domAnimation}>
      <TooltipProvider delay={0}>
        <SidebarProvider defaultOpen={defaultOpen}>
          <AppSidebar user={user} />
          <SidebarInset className="relative flex h-svh max-h-svh flex-col overflow-hidden bg-background">
            <ScrollArea className="h-full w-full">
              <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between pointer-events-none px-4 pt-3 pb-1">
                {/* Free-standing left items */}
                <div className="pointer-events-auto flex items-center gap-2">
                  <SidebarTrigger
                    aria-label="Toggle navigation"
                    className="size-9 rounded-full border border-border/60 bg-background/80 backdrop-blur-md shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground"
                  />
                </div>

                {/* Free-standing right items */}
                <div className="pointer-events-auto flex items-center gap-2">
                  <ThemeToggle className="size-9 rounded-full border border-border/60 bg-background/80 backdrop-blur-md shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground" />
                  <UserMenu
                    user={user}
                    className="size-9 rounded-full border border-border/60 bg-background/80 backdrop-blur-md shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground"
                  />
                </div>
              </header>
              <main className="flex flex-1 flex-col">{children}</main>
            </ScrollArea>
          </SidebarInset>
        </SidebarProvider>
      </TooltipProvider>
    </LazyMotion>
  )
}
