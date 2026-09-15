import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router"
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"

const mockSession = {
  session: { id: "sess-123" },
  user: { id: "user-123", email: "builder@example.com" },
}

mock.module("@/lib/session", () => ({
  getSession: async () => mockSession,
  ensureSession: async () => mockSession,
}))

const mockSignOut = mock(async () => ({}))
mock.module("@/lib/auth-client", () => ({
  signOut: mockSignOut,
}))

const mockSetActiveOrg = mock(async () => ({}))
mock.module("@/features/organizations/server", () => ({
  listOrganizationsFn: async () => [],
  getActiveOrganizationFn: async () => null,
  resolveAppOrganizationAccessFn: async () => ({ hasAccess: true }),
  checkSlugAvailabilityFn: async () => ({ available: true }),
  createOrganizationFn: async () => ({
    id: "org-1",
    name: "Acme",
    slug: "acme",
  }),
  setActiveOrganizationFn: mockSetActiveOrg,
  getOrganizationMembersFn: async () => [],
  getOrganizationInvitationsFn: async () => [],
  inviteMemberFn: async () => {},
  cancelInvitationFn: async () => {},
  updateMemberRoleFn: async () => {},
  removeMemberFn: async () => {},
  updateOrganizationFn: async () => ({}),
  leaveOrganizationFn: async () => ({ success: true }),
  deleteOrganizationFn: async () => ({ success: true }),
  getInvitationDetailsFn: async () => null,
  acceptInvitationFn: async () => {},
}))

const { Route: OnboardingRoute } = await import("./onboarding")

describe("OnboardingPage Component (Block 3)", () => {
  let container: HTMLDivElement
  let root: Root
  let queryClient: QueryClient

  beforeEach(() => {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    container.remove()
    document.body.innerHTML = ""
    queryClient.clear()
  })

  async function renderOnboarding(
    search: { step?: string; orgId?: string } = {},
  ) {
    const rootRoute = createRootRoute()
    const route = createRoute({
      getParentRoute: () => rootRoute,
      path: "/onboarding",
      component: OnboardingRoute.options.component,
      validateSearch: (s: Record<string, unknown>) => s,
    })

    const router = createRouter({
      routeTree: rootRoute.addChildren([route]),
      history: createMemoryHistory({
        initialEntries: [
          (() => {
            const params = new URLSearchParams()
            if (search.step) params.set("step", search.step)
            if (search.orgId) params.set("orgId", search.orgId)
            const qs = params.toString()
            return `/onboarding${qs ? `?${qs}` : ""}`
          })(),
        ],
      }),
      context: {
        queryClient,
        session: mockSession,
      },
    })

    await act(async () => {
      root.render(
        createElement(
          QueryClientProvider,
          { client: queryClient },
          createElement(RouterProvider, { router }),
        ),
      )
    })
  }

  it("renders Step 1 (Workspace Naming) with AuthShell, Stepper, and OrganizationForm", async () => {
    await renderOnboarding({ step: "naming" })

    expect(container.textContent).toContain("Step 01 / 3")
    expect(container.textContent).toContain("Name your workspace")
    expect(container.textContent).toContain("What are we calling it?")
    expect(container.textContent).toContain("builder@example.com")
    expect(container.textContent).toContain("Sign out")

    const namingStep = container.querySelector(
      '[data-testid="onboarding-step-naming"]',
    )
    expect(namingStep).not.toBeNull()
  })

  it("renders Step 2 (Teammate Invitations) with InviteMembersForm and Step 02 indicator", async () => {
    await renderOnboarding({
      step: "invites",
      orgId: "018f1a1a-0000-7000-8000-000000000001",
    })

    expect(container.textContent).toContain("Step 02 / 3")
    expect(container.textContent).toContain("Bring people with you")
    expect(container.textContent).toContain("Invite teammates")

    const invitesStep = container.querySelector(
      '[data-testid="onboarding-step-invites"]',
    )
    expect(invitesStep).not.toBeNull()
  })

  it("renders Step 3 (Ready / Welcome) with FactCard grid, Step 03 indicator, and launch button", async () => {
    await renderOnboarding({
      step: "welcome",
      orgId: "018f1a1a-0000-7000-8000-000000000001",
    })

    expect(container.textContent).toContain("Step 03 / 3")
    expect(container.textContent).toContain("You're set")
    expect(container.textContent).toContain("Workspace")
    expect(container.textContent).toContain("Invitations")
    expect(container.textContent).toContain("Slug")
    expect(container.textContent).toContain("Launch Workspace")

    const welcomeStep = container.querySelector(
      '[data-testid="onboarding-step-welcome"]',
    )
    expect(welcomeStep).not.toBeNull()
  })

  it("handles sign out click cleanly", async () => {
    await renderOnboarding({ step: "naming" })

    const signOutBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Sign out"),
    )
    expect(signOutBtn).toBeDefined()

    await act(async () => {
      signOutBtn?.click()
    })

    expect(mockSignOut).toHaveBeenCalled()
  })

  it("handles launch workspace click and calls setActiveOrganizationFn", async () => {
    const orgId = "018f1a1a-0000-7000-8000-000000000001"
    await renderOnboarding({
      step: "welcome",
      orgId,
    })

    const launchBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Launch Workspace"),
    )
    expect(launchBtn).toBeDefined()

    await act(async () => {
      launchBtn?.click()
    })

    expect(mockSetActiveOrg).toHaveBeenCalledWith({
      data: { organizationId: orgId },
    })
  })
})
