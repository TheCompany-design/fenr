/**
 * AppShell — composition root for every authenticated screen.
 *
 * Wraps the floating sidebar with the inset content area and a slim top
 * bar (mobile nav trigger + account menu). The workspace switcher lives at
 * the top of the sidebar, not here. Route content arrives via children (the
 * <Outlet /> rendered by the _app guard layout), so this component stays
 * route-agnostic.
 *
 * The top bar is chrome plus three empty slots. Everything a page wants to say
 * up there (its title, its actions) arrives through the header portal rather
 * than a header of the page's own, so the shell never has to learn what a
 * screen is and a screen never has to reimplement a top bar. See
 * `./header-portal`.
 *
 * The bar carries no border of its own: the content beneath it is one continuous
 * canvas, and a rule under the bar would be the only thing telling a reader
 * where one surface ends and the next begins.
 */
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@workspace/ui/components/sidebar"
import { TooltipProvider } from "@workspace/ui/components/tooltip"

import { domAnimation, LazyMotion } from "motion/react"
import { type SessionUser, UserMenu } from "@/components/shell/user-menu"
import type { ActiveOrganization } from "@/features/organizations"

import { AppSidebar } from "./app-sidebar"
import { HeaderPortalSlot } from "./header-portal"

export function AppShell({
  children,
  user,
  defaultOpen = true,
  activeOrganization,
}: {
  children: React.ReactNode
  user: SessionUser
  /** Initial sidebar state, restored from the sidebar_state cookie on SSR. */
  defaultOpen?: boolean
  activeOrganization?: ActiveOrganization | null
}) {
  return (
    // delay={0}: Base UI tooltips default to a 600ms open delay — nav
    // tooltips should feel instant. The provider also makes moving between
    // adjacent triggers switch tooltips instantly (delay group).
    <LazyMotion features={domAnimation}>
      <TooltipProvider delay={0}>
        <SidebarProvider defaultOpen={defaultOpen}>
          <AppSidebar activeOrganization={activeOrganization} />
          <SidebarInset className="relative flex h-svh max-h-svh flex-col overflow-hidden bg-background">
            {/*
             * The bar itself is pointer-events-none so it only ever intercepts a
             * click where there is something to click: every region, and the two
             * shell controls, opt back in. No bottom border — the canvas below
             * runs on uninterrupted.
             */}
            <header className="pointer-events-none relative z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border/60 bg-background/95 px-4 pt-3 pb-1 backdrop-blur-md">
              <SidebarTrigger
                aria-label="Toggle navigation"
                className="pointer-events-auto size-9 rounded-full border border-border/60 bg-background/80 shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground"
              />

              {/*
               * Feature content. `start` takes the free space so a title can
               * shrink and truncate without pushing the account menu off the
               * bar; `center` and `end` hug their content on either side of it.
               * The regions stay mounted whether or not a page has claimed one,
               * so the bar's layout never jumps between screens.
               */}
              <HeaderPortalSlot
                className="pointer-events-auto flex min-w-0 flex-1 items-center gap-2 overflow-hidden"
                region="start"
              />
              <HeaderPortalSlot
                className="pointer-events-auto flex min-w-0 items-center gap-2 overflow-hidden"
                region="center"
              />
              <HeaderPortalSlot
                className="pointer-events-auto flex shrink-0 items-center gap-2"
                region="end"
              />

              <UserMenu
                user={user}
                className="pointer-events-auto size-9 rounded-full border border-border/60 bg-background/80 shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground"
              />
            </header>
            <ScrollArea className="min-h-0 flex-1 w-full">
              <main className="flex h-full min-h-0 flex-1 flex-col">
                {children}
              </main>
            </ScrollArea>
          </SidebarInset>
        </SidebarProvider>
      </TooltipProvider>
    </LazyMotion>
  )
}
