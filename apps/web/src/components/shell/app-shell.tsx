/**
 * AppShell — composition root for every authenticated screen.
 *
 * Wraps the floating sidebar with the inset content area and a slim top
 * bar (mobile nav trigger + active-section label). Route content arrives
 * via children (the <Outlet /> rendered by the _protected guard layout),
 * so this component stays route-agnostic.
 */
import { Separator } from "@workspace/ui/components/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@workspace/ui/components/sidebar"

import { ThemeToggle } from "@/components/shell/theme-toggle"
import { type SessionUser, UserMenu } from "@/components/shell/user-menu"

import { AppSidebar, useActiveNavId } from "./app-sidebar"
import { NAV_ITEMS } from "./nav-config"

function PageTitle() {
  const activeId = useActiveNavId()
  const active = NAV_ITEMS.find((item) => item.id === activeId)
  return (
    <span className="truncate font-medium text-sm">
      {active?.title ?? "Fenr"}
    </span>
  )
}

export function AppShell({
  children,
  user,
}: {
  children: React.ReactNode
  user: SessionUser
}) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="flex min-h-svh flex-col">
        <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-border border-b bg-background/80 px-3 backdrop-blur">
          <SidebarTrigger aria-label="Toggle navigation" />
          <Separator
            className="data-[orientation=vertical]:h-4"
            orientation="vertical"
          />
          <PageTitle />
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <UserMenu user={user} />
          </div>
        </header>
        <main className="flex flex-1 flex-col">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
