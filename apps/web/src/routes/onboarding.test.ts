import { describe, expect, it, mock } from "bun:test"
import { isRedirect } from "@tanstack/react-router"

let currentSession: {
  session: { id: string }
  user: { id: string; email: string }
} | null = null

let currentOrganizations: Array<{ id: string; name: string; slug: string }> = []

mock.module("@/lib/session", () => ({
  getSession: async () => currentSession,
  ensureSession: async () => {
    if (!currentSession) throw new Error("Unauthorized")
    return currentSession
  },
}))

import { onboardingSearchSchema } from "@/lib/schemas/search"

// Import Route after mock.module
const { Route: OnboardingRoute } = await import("./onboarding")

type BeforeLoadCaller = (opts: {
  location: { href: string; pathname?: string }
  search: { step?: "naming" | "invites" | "welcome"; orgId?: string }
  context: {
    queryClient: {
      ensureQueryData: () => Promise<
        Array<{ id: string; name: string; slug: string }>
      >
      fetchQuery?: () => Promise<
        Array<{ id: string; name: string; slug: string }>
      >
    }
  }
}) => Promise<{ session: unknown }>

function getRedirectDetails(thrown: unknown) {
  if (!isRedirect(thrown)) return null
  const redirectObj = thrown as {
    options?: { to?: string; search?: Record<string, unknown> }
  }
  return {
    to: redirectObj.options?.to,
    search: redirectObj.options?.search,
  }
}

describe("/onboarding Route & Step Progression (Atom 9)", () => {
  describe("onboardingSearchSchema", () => {
    it("parses valid steps correctly", () => {
      expect(onboardingSearchSchema.parse({ step: "naming" })).toEqual({
        step: "naming",
        orgId: undefined,
      })
      expect(onboardingSearchSchema.parse({ step: "invites" })).toEqual({
        step: "invites",
        orgId: undefined,
      })
      expect(onboardingSearchSchema.parse({ step: "welcome" })).toEqual({
        step: "welcome",
        orgId: undefined,
      })
    })

    it("defaults to naming step when omitted or empty", () => {
      const expectedSearch = {
        step: "naming" as const,
        orgId: undefined,
      }
      expect(onboardingSearchSchema.parse({})).toEqual(expectedSearch)
      expect(onboardingSearchSchema.parse({ step: "" })).toEqual(expectedSearch)
    })

    it("falls back to naming when invalid step string is supplied", () => {
      expect(onboardingSearchSchema.parse({ step: "invalid_step" })).toEqual({
        step: "naming",
        orgId: undefined,
      })
    })

    it("validates valid UUID orgId", () => {
      const validUuid = "018f1a1a-0000-7000-8000-000000000001"
      expect(
        onboardingSearchSchema.parse({
          step: "invites",
          orgId: validUuid,
        }),
      ).toEqual({
        step: "invites",
        orgId: validUuid,
      })
    })

    it("catches invalid UUID orgId values to undefined", () => {
      expect(
        onboardingSearchSchema.parse({
          step: "invites",
          orgId: "not-a-uuid",
        }),
      ).toEqual({
        step: "invites",
        orgId: undefined,
      })
      expect(
        onboardingSearchSchema.parse({
          step: "invites",
          orgId: "",
        }),
      ).toEqual({
        step: "invites",
        orgId: undefined,
      })
      expect(
        onboardingSearchSchema.parse({
          orgId: "invalid-uuid",
        }),
      ).toEqual({
        step: "naming",
        orgId: undefined,
      })
    })
  })

  describe("beforeLoad Step Guards", () => {
    const beforeLoad = OnboardingRoute.options
      .beforeLoad as unknown as BeforeLoadCaller

    const mockContext = {
      queryClient: {
        ensureQueryData: async () => currentOrganizations,
        fetchQuery: async () => currentOrganizations,
      },
    }

    it("redirects unauthenticated users to /auth/sign-in with redirect param", async () => {
      currentSession = null
      try {
        await beforeLoad({
          location: { href: "/onboarding" },
          search: { step: "naming" },
          context: mockContext,
        })
        expect.unreachable("Should have redirected")
      } catch (thrown) {
        const details = getRedirectDetails(thrown)
        expect(details?.to).toBe("/auth/sign-in")
        expect(details?.search).toEqual({ redirect: "/onboarding" })
      }
    })

    it("allows authenticated user to land on naming step", async () => {
      currentSession = {
        session: { id: "sess-1" },
        user: { id: "user-1", email: "alice@example.com" },
      }

      const result = await beforeLoad({
        location: { href: "/onboarding" },
        search: { step: "naming" },
        context: mockContext,
      })

      expect(result.session).toBeDefined()
    })

    it("redirects to naming step if user tries to jump to invites without orgId", async () => {
      currentSession = {
        session: { id: "sess-1" },
        user: { id: "user-1", email: "alice@example.com" },
      }

      try {
        await beforeLoad({
          location: { href: "/onboarding?step=invites" },
          search: { step: "invites" },
          context: mockContext,
        })
        expect.unreachable("Should have redirected to naming")
      } catch (thrown) {
        const details = getRedirectDetails(thrown)
        expect(details?.to).toBe("/onboarding")
        expect(details?.search).toEqual({ step: "naming" })
      }
    })

    it("redirects to naming step if user tries to jump to invites with orgId they don't belong to", async () => {
      currentSession = {
        session: { id: "sess-1" },
        user: { id: "user-1", email: "alice@example.com" },
      }
      currentOrganizations = [{ id: "org-1", name: "Org 1", slug: "org-1" }]

      try {
        await beforeLoad({
          location: {
            href: "/onboarding?step=invites&orgId=018f1a1a-0000-7000-8000-000000000099",
          },
          search: {
            step: "invites",
            orgId: "018f1a1a-0000-7000-8000-000000000099",
          },
          context: mockContext,
        })
        expect.unreachable("Should have redirected to naming")
      } catch (thrown) {
        const details = getRedirectDetails(thrown)
        expect(details?.to).toBe("/onboarding")
        expect(details?.search).toEqual({ step: "naming" })
      }
    })

    it("redirects to naming step if user tries to jump to welcome without orgId", async () => {
      currentSession = {
        session: { id: "sess-1" },
        user: { id: "user-1", email: "alice@example.com" },
      }

      try {
        await beforeLoad({
          location: { href: "/onboarding?step=welcome" },
          search: { step: "welcome" },
          context: mockContext,
        })
        expect.unreachable("Should have redirected to naming")
      } catch (thrown) {
        const details = getRedirectDetails(thrown)
        expect(details?.to).toBe("/onboarding")
        expect(details?.search).toEqual({ step: "naming" })
      }
    })

    it("redirects to naming step if user tries to jump to welcome with orgId they don't belong to", async () => {
      currentSession = {
        session: { id: "sess-1" },
        user: { id: "user-1", email: "alice@example.com" },
      }
      currentOrganizations = [{ id: "org-1", name: "Org 1", slug: "org-1" }]

      try {
        await beforeLoad({
          location: {
            href: "/onboarding?step=welcome&orgId=018f1a1a-0000-7000-8000-000000000099",
          },
          search: {
            step: "welcome",
            orgId: "018f1a1a-0000-7000-8000-000000000099",
          },
          context: mockContext,
        })
        expect.unreachable("Should have redirected to naming")
      } catch (thrown) {
        const details = getRedirectDetails(thrown)
        expect(details?.to).toBe("/onboarding")
        expect(details?.search).toEqual({ step: "naming" })
      }
    })

    it("recovers from stale ensureQueryData cache via fetchQuery fallback", async () => {
      const validOrgId = "018f1a1a-0000-7000-8000-000000000001"
      currentSession = {
        session: { id: "sess-1" },
        user: { id: "user-1", email: "alice@example.com" },
      }
      let fetchQueryCalled = false
      const staleContext = {
        queryClient: {
          ensureQueryData: async () => [], // stale cache returns empty
          fetchQuery: async () => {
            fetchQueryCalled = true
            return [{ id: validOrgId, name: "Acme Corp", slug: "acme" }]
          },
        },
      }

      const result = await beforeLoad({
        location: { href: `/onboarding?step=invites&orgId=${validOrgId}` },
        search: { step: "invites", orgId: validOrgId },
        context: staleContext,
      })

      expect(fetchQueryCalled).toBe(true)
      expect(result.session).toBeDefined()
    })

    it("allows user to proceed to invites or welcome if they belong to the orgId", async () => {
      const validOrgId = "018f1a1a-0000-7000-8000-000000000001"
      currentSession = {
        session: { id: "sess-1" },
        user: { id: "user-1", email: "alice@example.com" },
      }
      currentOrganizations = [
        { id: validOrgId, name: "Acme Corp", slug: "acme" },
      ]

      const resultInvites = await beforeLoad({
        location: { href: `/onboarding?step=invites&orgId=${validOrgId}` },
        search: { step: "invites", orgId: validOrgId },
        context: mockContext,
      })
      expect(resultInvites.session).toBeDefined()

      const resultWelcome = await beforeLoad({
        location: { href: `/onboarding?step=welcome&orgId=${validOrgId}` },
        search: { step: "welcome", orgId: validOrgId },
        context: mockContext,
      })
      expect(resultWelcome.session).toBeDefined()
    })
  })

  describe("loader SSR prefetching", () => {
    const loader = OnboardingRoute.options.loader as unknown as (opts: {
      context: {
        queryClient: {
          ensureQueryData: (opts: unknown) => Promise<unknown>
        }
      }
    }) => Promise<void>

    it("prefetches organization list on route load", async () => {
      let ensured = false
      await loader({
        context: {
          queryClient: {
            ensureQueryData: async () => {
              ensured = true
              return []
            },
          },
        },
      })
      expect(ensured).toBe(true)
    })

    it("catches errors gracefully when ensureQueryData fails", async () => {
      let ensured = false
      await expect(
        loader({
          context: {
            queryClient: {
              ensureQueryData: async () => {
                ensured = true
                throw new Error("Network error")
              },
            },
          },
        }),
      ).resolves.toBeUndefined()
      expect(ensured).toBe(true)
    })
  })
})
