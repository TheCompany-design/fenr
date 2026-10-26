import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"
import { AppErrorComponent } from "@/components/shell/app-error"
import { AppShell } from "@/components/shell/app-shell"
import { resolveAppOrganizationAccessFn } from "@/features/organizations"
import { getSession } from "@/lib/auth/session"
import { safeRedirectPath } from "@/lib/navigation"
import { getSidebarOpen } from "@/lib/preferences"

function GuardLayout() {
  const { session, sidebarOpen, activeOrganization } = Route.useRouteContext()
  return (
    <AppShell
      defaultOpen={sidebarOpen}
      user={session.user}
      activeOrganization={activeOrganization}
    >
      <Outlet />
    </AppShell>
  )
}

export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ location }) => {
    const [session, sidebarOpen] = await Promise.all([
      getSession(),
      getSidebarOpen(),
    ])
    if (!session) {
      throw redirect({
        to: "/auth/sign-in",
        search: { redirect: safeRedirectPath(location.href) },
      })
    }

    const access = await resolveAppOrganizationAccessFn()

    if (access.status === "no_organizations") {
      throw redirect({ to: "/onboarding", search: { step: "naming" } })
    }
    if (access.status === "choose_organization") {
      throw redirect({
        to: "/choose-organization",
        search: { redirect: safeRedirectPath(location.href) },
      })
    }

    return {
      session: {
        ...session,
        session: {
          ...session.session,
          activeOrganizationId: access.activeOrganization.organization.id,
        },
      },
      sidebarOpen,
      activeOrganization: access.activeOrganization,
    }
  },
  component: GuardLayout,
  errorComponent: AppErrorComponent,
})
