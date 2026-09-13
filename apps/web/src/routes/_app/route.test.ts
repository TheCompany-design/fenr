import { afterAll, describe, expect, it, mock } from "bun:test"
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  isRedirect,
  RouterProvider,
} from "@tanstack/react-router"
import { GlobalWindow } from "happy-dom"
import { act, createElement } from "react"
import { createRoot } from "react-dom/client"

// Setup DOM globals for component tests
const originalWindow = globalThis.window
const originalDocument = globalThis.document
const originalNavigator = globalThis.navigator
const originalElement = globalThis.Element
const originalHTMLElement = globalThis.HTMLElement
const originalNode = globalThis.Node
const originalCustomElements = globalThis.customElements

const win = new GlobalWindow({ url: "http://localhost:3000" })
Object.assign(globalThis, {
  window: win,
  document: win.document,
  navigator: win.navigator,
  Element: win.Element,
  HTMLElement: win.HTMLElement,
  Node: win.Node,
  customElements: win.customElements,
  scrollTo: () => {},
  requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(cb, 0),
  cancelAnimationFrame: (id: number) => clearTimeout(id),
})

afterAll(() => {
  if (originalWindow === undefined)
    delete (globalThis as Record<string, unknown>).window
  else globalThis.window = originalWindow

  if (originalDocument === undefined)
    delete (globalThis as Record<string, unknown>).document
  else globalThis.document = originalDocument

  if (originalNavigator === undefined)
    delete (globalThis as Record<string, unknown>).navigator
  else globalThis.navigator = originalNavigator

  if (originalElement === undefined)
    delete (globalThis as Record<string, unknown>).Element
  else globalThis.Element = originalElement

  if (originalHTMLElement === undefined)
    delete (globalThis as Record<string, unknown>).HTMLElement
  else globalThis.HTMLElement = originalHTMLElement

  if (originalNode === undefined)
    delete (globalThis as Record<string, unknown>).Node
  else globalThis.Node = originalNode

  if (originalCustomElements === undefined)
    delete (globalThis as Record<string, unknown>).customElements
  else globalThis.customElements = originalCustomElements
})

let currentSession: {
  session: { id: string; activeOrganizationId?: string | null }
  user: { id: string; email: string }
} | null = null

let currentAccessResult: {
  status: "authorized" | "no_organizations" | "choose_organization"
  activeOrganization?: unknown
  count?: number
} = { status: "no_organizations" }

let currentSidebarOpen = true
let currentOrganizationsList: Array<Record<string, unknown>> = []

mock.module("@/lib/session", () => ({
  getSession: async () => currentSession,
  ensureSession: async () => {
    if (!currentSession) throw new Error("Unauthorized")
    return currentSession
  },
}))

mock.module("@/lib/ui-prefs", () => ({
  getSidebarOpen: async () => currentSidebarOpen,
}))

const actualOrgs = await import("@/features/organizations")

let currentAccessError: Error | null = null

let activeOrgDelayPromise: Promise<void> | null = null

mock.module("@/features/organizations", () => ({
  ...actualOrgs,
  resolveAppOrganizationAccessFn: async () => {
    if (currentAccessError) throw currentAccessError
    return currentAccessResult
  },
  listOrganizationsFn: async () => currentOrganizationsList,
  setActiveOrganizationFn: async () => {
    if (activeOrgDelayPromise) await activeOrgDelayPromise
    return { success: true }
  },
}))

// Import routes after mock.module so they use the mocked session and server functions
const { Route: AppRoute, AppErrorComponent } = await import("./route")
const { Route: ChooseOrgRoute } = await import("@/routes/choose-organization")
const { Route: OnboardingRoute } = await import("@/routes/onboarding")

type BeforeLoadCaller = (opts: {
  location: { href: string; pathname?: string }
  search?: Record<string, unknown>
  context?: Record<string, unknown>
}) => Promise<{
  session?: unknown
  sidebarOpen?: unknown
  activeOrganization?: unknown
  [key: string]: unknown
}>

function getRedirectDetails(thrown: unknown) {
  if (!isRedirect(thrown)) return null
  const redirectObj = thrown as {
    options?: { to?: string; search?: Record<string, unknown> }
    headers?: Headers
  }
  return {
    to: redirectObj.options?.to,
    search: redirectObj.options?.search,
    locationHeader: redirectObj.headers?.get("location"),
  }
}

describe("App & Organization Route Guards Invariants (Atom 6)", () => {
  describe("/_app Layout Route Guard", () => {
    it("redirects unauthenticated visitors to /auth/sign-in preserving deep-link redirect", async () => {
      currentSession = null

      let thrown: unknown = null
      try {
        const beforeLoad = AppRoute.options
          .beforeLoad as unknown as BeforeLoadCaller
        await beforeLoad({ location: { href: "/documents/123" } })
      } catch (e) {
        thrown = e
      }

      expect(isRedirect(thrown)).toBe(true)
      const details = getRedirectDetails(thrown)
      expect(details?.to).toBe("/auth/sign-in")
      expect(details?.search).toEqual({ redirect: "/documents/123" })
    })

    it("redirects authenticated user with 0 memberships to /onboarding", async () => {
      currentSession = {
        session: { id: "sess-1" },
        user: { id: "user-1", email: "newuser@example.com" },
      }
      currentAccessResult = { status: "no_organizations" }

      let thrown: unknown = null
      try {
        const beforeLoad = AppRoute.options
          .beforeLoad as unknown as BeforeLoadCaller
        await beforeLoad({ location: { href: "/" } })
      } catch (e) {
        thrown = e
      }

      expect(isRedirect(thrown)).toBe(true)
      const details = getRedirectDetails(thrown)
      expect(details?.to).toBe("/onboarding")
    })

    it("redirects authenticated user with >1 memberships and no preference to /choose-organization", async () => {
      currentSession = {
        session: { id: "sess-2" },
        user: { id: "user-2", email: "multiuser@example.com" },
      }
      currentAccessResult = { status: "choose_organization", count: 3 }

      let thrown: unknown = null
      try {
        const beforeLoad = AppRoute.options
          .beforeLoad as unknown as BeforeLoadCaller
        await beforeLoad({ location: { href: "/settings/team" } })
      } catch (e) {
        thrown = e
      }

      expect(isRedirect(thrown)).toBe(true)
      const details = getRedirectDetails(thrown)
      expect(details?.to).toBe("/choose-organization")
      expect(details?.search).toEqual({ redirect: "/settings/team" })
    })

    it("allows authenticated user with valid active organization to enter application", async () => {
      const mockActiveOrg = {
        organization: {
          id: "org-1",
          name: "Acme Corp",
          slug: "acme-corp",
          logo: null,
          createdAt: new Date(),
        },
        role: "owner",
        joinedAt: new Date(),
        memberCount: 5,
      }

      currentSession = {
        session: { id: "sess-3" },
        user: { id: "user-3", email: "owner@example.com" },
      }
      currentAccessResult = {
        status: "authorized",
        activeOrganization: mockActiveOrg,
      }
      currentSidebarOpen = true

      const beforeLoad = AppRoute.options
        .beforeLoad as unknown as BeforeLoadCaller
      const context = await beforeLoad({ location: { href: "/" } })

      expect(context).toBeDefined()
      expect(context.session).toEqual({
        ...currentSession,
        session: {
          ...currentSession.session,
          activeOrganizationId: mockActiveOrg.organization.id,
        },
      })
      expect(context.sidebarOpen).toBe(true)
      expect(context.activeOrganization).toEqual(mockActiveOrg)
    })

    it("propagates and throws error when resolveAppOrganizationAccessFn fails", async () => {
      currentSession = {
        session: { id: "sess-error" },
        user: { id: "user-error", email: "error@example.com" },
      }
      currentAccessError = new Error("Database network failure")

      let thrown: unknown = null
      try {
        const beforeLoad = AppRoute.options
          .beforeLoad as unknown as BeforeLoadCaller
        await beforeLoad({ location: { href: "/documents/456" } })
      } catch (e) {
        thrown = e
      } finally {
        currentAccessError = null
      }

      expect(isRedirect(thrown)).toBe(false)
      expect(thrown).toBeInstanceOf(Error)
      expect((thrown as Error).message).toBe("Database network failure")
    })

    it("registers AppErrorComponent as errorComponent on AppRoute", () => {
      expect(AppRoute.options.errorComponent).toBeDefined()
      expect(AppRoute.options.errorComponent).toBe(AppErrorComponent)
    })
  })

  describe("AppErrorComponent", () => {
    it("renders error state and handles retry with router invalidation and reset", async () => {
      let invalidateCalled = false
      let resetCalled = false

      const rootRoute = createRootRoute({
        component: () =>
          createElement(AppErrorComponent, {
            error: new Error("Workspace error"),
            reset: () => {
              resetCalled = true
            },
          }),
      })
      const router = createRouter({
        routeTree: rootRoute,
        history: createMemoryHistory(),
      })
      router.invalidate = async () => {
        invalidateCalled = true
      }
      await router.load()

      const container = document.createElement("div")
      document.body.appendChild(container)
      const root = createRoot(container)

      await act(async () => {
        root.render(createElement(RouterProvider, { router }))
      })

      expect(container.innerHTML).toContain("Unable to load organization")
      const button = container.querySelector("button")
      expect(button).not.toBeNull()
      expect(button?.textContent).toContain("Try again")

      await act(async () => {
        button?.click()
      })

      expect(invalidateCalled).toBe(true)
      expect(resetCalled).toBe(true)

      act(() => {
        root.unmount()
      })
      container.remove()
    })

    it("guards against concurrent retry clicks while invalidation is in flight", async () => {
      let invalidateCalls = 0
      let resolveInvalidate: () => void = () => {}
      const invalidatePromise = new Promise<void>((resolve) => {
        resolveInvalidate = resolve
      })

      const rootRoute = createRootRoute({
        component: () =>
          createElement(AppErrorComponent, {
            error: new Error("Workspace error"),
            reset: () => {},
          }),
      })
      const router = createRouter({
        routeTree: rootRoute,
        history: createMemoryHistory(),
      })
      router.invalidate = async () => {
        invalidateCalls++
        return invalidatePromise
      }
      await router.load()

      const container = document.createElement("div")
      document.body.appendChild(container)
      const root = createRoot(container)

      await act(async () => {
        root.render(createElement(RouterProvider, { router }))
      })

      const button = container.querySelector("button")
      expect(button).not.toBeNull()

      // First click: initiates retry
      await act(async () => {
        button?.click()
      })
      expect(invalidateCalls).toBe(1)
      expect(button?.textContent).toContain("Retrying...")
      expect(button?.hasAttribute("disabled")).toBe(true)

      // Concurrent second click should be ignored while isRetrying is true
      await act(async () => {
        button?.click()
      })
      expect(invalidateCalls).toBe(1)

      // Complete in-flight invalidation
      await act(async () => {
        resolveInvalidate()
      })

      expect(button?.textContent).toContain("Try again")
      expect(button?.hasAttribute("disabled")).toBe(false)

      act(() => {
        root.unmount()
      })
      container.remove()
    })

    it("handles router invalidation failure gracefully without unhandled crashes", async () => {
      const rootRoute = createRootRoute({
        component: () =>
          createElement(AppErrorComponent, {
            error: new Error("Access error"),
            reset: () => {},
          }),
      })
      const router = createRouter({
        routeTree: rootRoute,
        history: createMemoryHistory(),
      })
      router.invalidate = async () => {
        throw new Error("Network reload failure")
      }
      await router.load()

      const container = document.createElement("div")
      document.body.appendChild(container)
      const root = createRoot(container)

      await act(async () => {
        root.render(createElement(RouterProvider, { router }))
      })

      const button = container.querySelector("button")
      expect(button).not.toBeNull()

      await act(async () => {
        button?.click()
      })

      // Button is re-enabled after failure
      expect(button?.hasAttribute("disabled")).toBe(false)
      expect(button?.textContent).toContain("Try again")

      act(() => {
        root.unmount()
      })
      container.remove()
    })
  })

  describe("/choose-organization Route Guard", () => {
    it("redirects unauthenticated visitors to /auth/sign-in", async () => {
      currentSession = null

      let thrown: unknown = null
      try {
        const beforeLoad = ChooseOrgRoute.options
          .beforeLoad as unknown as BeforeLoadCaller
        await beforeLoad({
          location: { href: "/choose-organization?redirect=/app" },
        })
      } catch (e) {
        thrown = e
      }

      expect(isRedirect(thrown)).toBe(true)
      const details = getRedirectDetails(thrown)
      expect(details?.to).toBe("/auth/sign-in")
      expect(details?.search).toEqual({
        redirect: "/choose-organization?redirect=/app",
      })
    })

    it("redirects authenticated users with 0 memberships to /onboarding", async () => {
      currentSession = {
        session: { id: "sess-4" },
        user: { id: "user-4", email: "zero@example.com" },
      }
      currentOrganizationsList = []

      let thrown: unknown = null
      try {
        const beforeLoad = ChooseOrgRoute.options
          .beforeLoad as unknown as BeforeLoadCaller
        await beforeLoad({
          location: { href: "/choose-organization" },
          context: {
            queryClient: {
              ensureQueryData: async () => currentOrganizationsList,
            },
          },
        })
      } catch (e) {
        thrown = e
      }

      expect(isRedirect(thrown)).toBe(true)
      const details = getRedirectDetails(thrown)
      expect(details?.to).toBe("/onboarding")
    })

    it("allows authenticated users with memberships to stay on choose-organization", async () => {
      currentSession = {
        session: { id: "sess-5" },
        user: { id: "user-5", email: "hasorgs@example.com" },
      }
      currentOrganizationsList = [
        {
          id: "org-1",
          name: "Org One",
          slug: "org-one",
          role: "member",
          memberCount: 2,
          isActive: false,
        },
      ]

      const beforeLoad = ChooseOrgRoute.options
        .beforeLoad as unknown as BeforeLoadCaller
      const context = await beforeLoad({
        location: { href: "/choose-organization" },
        context: {
          queryClient: {
            ensureQueryData: async () => currentOrganizationsList,
          },
        },
      })

      expect(context).toBeDefined()
      expect(context.session).toEqual(currentSession)
    })

    it("renders choose-organization and disables Create organization button during selection without blocking navigation", async () => {
      const { QueryClient, QueryClientProvider } = await import(
        "@tanstack/react-query"
      )

      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      })
      queryClient.setQueryData(
        ["organizations", "list"],
        [
          {
            id: "org-1",
            name: "Org One",
            slug: "org-one",
            role: "owner",
            memberCount: 2,
            isActive: false,
          },
        ],
      )

      let navigateCalledWith: unknown = null
      let invalidateStarted = false
      let invalidateFinished = false

      let resolveInvalidate: () => void = () => {}
      const invalidatePromise = new Promise<void>((resolve) => {
        resolveInvalidate = resolve
      })

      const origUseSearch = ChooseOrgRoute.useSearch
      const origUseRouteContext = ChooseOrgRoute.useRouteContext
      ChooseOrgRoute.useSearch = (() => ({
        redirect: undefined,
      })) as unknown as typeof ChooseOrgRoute.useSearch
      ChooseOrgRoute.useRouteContext = (() => ({
        session: {
          session: { id: "sess-choose" },
          user: { id: "user-choose", email: "choose@example.com" },
        },
      })) as unknown as typeof ChooseOrgRoute.useRouteContext

      const Component = ChooseOrgRoute.options
        .component as () => React.ReactNode

      const rootRoute = createRootRoute({
        component: () =>
          createElement(
            QueryClientProvider,
            { client: queryClient },
            createElement(Component),
          ),
      })

      const router = createRouter({
        routeTree: rootRoute,
        history: createMemoryHistory(),
      })

      router.navigate = (async (opts: unknown) => {
        navigateCalledWith = opts
        // Crucial invariant: navigation must NOT block on router.invalidate() completing
        expect(invalidateStarted).toBe(true)
        expect(invalidateFinished).toBe(false)
      }) as typeof router.navigate

      router.invalidate = async () => {
        invalidateStarted = true
        await invalidatePromise
        invalidateFinished = true
      }

      await router.load()

      const container = document.createElement("div")
      document.body.appendChild(container)
      const root = createRoot(container)

      await act(async () => {
        root.render(createElement(RouterProvider, { router }))
      })

      expect(container.innerHTML).toContain("Select an organization")
      const orgButton = container.querySelector(
        "button[aria-label*='Org One']",
      ) as HTMLButtonElement | null
      const createButton = Array.from(
        container.querySelectorAll("a, button"),
      ).find((el) => el.textContent?.includes("Create new organization"))

      expect(orgButton).not.toBeNull()
      expect(createButton).toBeDefined()
      expect(createButton?.getAttribute("aria-disabled")).toBeNull()

      let resolveSelect: () => void = () => {}
      activeOrgDelayPromise = new Promise<void>((resolve) => {
        resolveSelect = resolve
      })

      // Click the org selection button
      await act(async () => {
        orgButton?.click()
      })

      // The create button is disabled while selection is active in-flight
      expect(createButton?.getAttribute("aria-disabled")).toBe("true")

      // Now resolve the active org selection
      await act(async () => {
        resolveSelect()
      })

      // Navigation was called without awaiting invalidate
      expect(navigateCalledWith).toEqual({ href: "/" })

      // Clean up in-flight invalidation promise
      await act(async () => {
        resolveInvalidate()
      })

      activeOrgDelayPromise = null
      ChooseOrgRoute.useSearch = origUseSearch
      ChooseOrgRoute.useRouteContext = origUseRouteContext

      act(() => {
        root.unmount()
      })
      container.remove()
    })
  })

  describe("/onboarding Route Guard", () => {
    it("redirects unauthenticated visitors to /auth/sign-in?redirect=/onboarding", async () => {
      currentSession = null

      let thrown: unknown = null
      try {
        const beforeLoad = OnboardingRoute.options
          .beforeLoad as unknown as BeforeLoadCaller
        await beforeLoad({
          location: { href: "/onboarding" },
          search: { step: "naming" },
        })
      } catch (e) {
        thrown = e
      }

      expect(isRedirect(thrown)).toBe(true)
      const details = getRedirectDetails(thrown)
      expect(details?.to).toBe("/auth/sign-in")
      expect(details?.search).toEqual({ redirect: "/onboarding" })
    })

    it("allows authenticated visitors to access onboarding", async () => {
      currentSession = {
        session: { id: "sess-6" },
        user: { id: "user-6", email: "onboarding-user@example.com" },
      }

      const beforeLoad = OnboardingRoute.options
        .beforeLoad as unknown as BeforeLoadCaller
      const context = await beforeLoad({
        location: { href: "/onboarding" },
        search: { step: "naming" },
      })

      expect(context).toBeDefined()
      expect(context.session).toEqual(currentSession)
    })
  })
})
