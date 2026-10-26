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

  defaultOpen?: boolean
  activeOrganization?: ActiveOrganization | null
}) {
  return (
    <LazyMotion features={domAnimation}>
      <TooltipProvider delay={0}>
        <SidebarProvider defaultOpen={defaultOpen}>
          <AppSidebar activeOrganization={activeOrganization} />
          <SidebarInset className="relative flex h-svh max-h-svh flex-col overflow-hidden bg-background">
            {}
            <header className="pointer-events-none relative z-30 flex h-14 shrink-0 items-center gap-2 bg-background/95 px-4 pt-3 pb-1 backdrop-blur-md">
              <SidebarTrigger
                aria-label="Toggle navigation"
                className="pointer-events-auto size-9 rounded-full border border-border/60 bg-background/80 shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground"
              />

              {}
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
