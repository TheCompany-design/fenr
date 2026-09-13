import { describe, expect, it, mock } from "bun:test"
import { isRedirect } from "@tanstack/react-router"

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

mock.module("@/features/organizations", () => ({
  ...actualOrgs,
  resolveAppOrganizationAccessFn: async () => {
    if (currentAccessError) throw currentAccessError
    return currentAccessResult
  },
  listOrganizationsFn: async () => currentOrganizationsList,
  setActiveOrganizationFn: async () => ({ success: true }),
}))

// Import routes after mock.module so they use the mocked session and server functions
const { Route: AppRoute } = await import("./route")
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

    it("redirects to /auth/sign-in with error=access_resolution_failed when resolveAppOrganizationAccessFn throws", async () => {
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

      expect(isRedirect(thrown)).toBe(true)
      const details = getRedirectDetails(thrown)
      expect(details?.to).toBe("/auth/sign-in")
      expect(details?.search).toEqual({
        redirect: "/documents/456",
        error: "access_resolution_failed",
      })
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
