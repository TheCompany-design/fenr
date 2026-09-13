import { describe, expect, it, mock } from "bun:test"
import { isRedirect } from "@tanstack/react-router"

let currentSession: {
  session: { id: string }
  user: { id: string; email: string }
} | null = null

mock.module("@/lib/session", () => ({
  getSession: async () => currentSession,
  ensureSession: async () => {
    if (!currentSession) throw new Error("Unauthorized")
    return currentSession
  },
}))

// Import Route after mock.module
const { Route: AcceptRoute, invitationAcceptSearchSchema } = await import(
  "./accept"
)

type BeforeLoadCaller = (opts: {
  location: { href: string; pathname?: string }
  search: { id?: string }
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

describe("/invitations/accept Route & Step Guards (Atom 10)", () => {
  describe("invitationAcceptSearchSchema", () => {
    it("parses valid invitation id correctly", () => {
      const parsed = invitationAcceptSearchSchema.parse({
        id: "018f1a1a-0000-7000-8000-000000000001",
      })
      expect(parsed.id).toBe("018f1a1a-0000-7000-8000-000000000001")
    })

    it("handles missing or invalid id safely", () => {
      expect(invitationAcceptSearchSchema.parse({})).toEqual({ id: undefined })
      expect(invitationAcceptSearchSchema.parse({ id: 12345 })).toEqual({
        id: undefined,
      })
      expect(invitationAcceptSearchSchema.parse({ id: ["invalid"] })).toEqual({
        id: undefined,
      })
    })
  })

  describe("beforeLoad Authentication Guard", () => {
    const beforeLoad = AcceptRoute.options
      .beforeLoad as unknown as BeforeLoadCaller

    it("redirects unauthenticated users to /auth/sign-in with redirect param including id", async () => {
      currentSession = null
      const inviteId = "018f1a1a-0000-7000-8000-000000000001"

      try {
        await beforeLoad({
          location: { href: `/invitations/accept?id=${inviteId}` },
          search: { id: inviteId },
        })
        expect.unreachable("Should have redirected to sign-in")
      } catch (thrown) {
        const details = getRedirectDetails(thrown)
        expect(details?.to).toBe("/auth/sign-in")
        expect(details?.search).toEqual({
          redirect: `/invitations/accept?id=${encodeURIComponent(inviteId)}`,
        })
      }
    })

    it("redirects unauthenticated users to /auth/sign-in without id param when id is missing", async () => {
      currentSession = null

      try {
        await beforeLoad({
          location: { href: "/invitations/accept" },
          search: {},
        })
        expect.unreachable("Should have redirected to sign-in")
      } catch (thrown) {
        const details = getRedirectDetails(thrown)
        expect(details?.to).toBe("/auth/sign-in")
        expect(details?.search).toEqual({
          redirect: "/invitations/accept",
        })
      }
    })

    it("allows authenticated user to land on acceptance route", async () => {
      currentSession = {
        session: { id: "sess-123" },
        user: { id: "user-123", email: "user@example.com" },
      }

      const result = await beforeLoad({
        location: { href: "/invitations/accept?id=test-id" },
        search: { id: "test-id" },
      })

      expect(result.session).toBeDefined()
    })
  })

  describe("loader SSR prefetching", () => {
    const loader = AcceptRoute.options.loader as unknown as (opts: {
      context: {
        queryClient: { ensureQueryData: (opts: unknown) => Promise<unknown> }
      }
      deps: { id?: string }
    }) => Promise<void>

    it("ensures invitation details query data when id is present", async () => {
      let ensured = false
      await loader({
        context: {
          queryClient: {
            ensureQueryData: async () => {
              ensured = true
              return {}
            },
          },
        },
        deps: { id: "018f1a1a-0000-7000-8000-000000000001" },
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
          deps: { id: "018f1a1a-0000-7000-8000-000000000001" },
        }),
      ).resolves.toBeUndefined()
      expect(ensured).toBe(true)
    })

    it("does not call ensureQueryData when id is missing or empty or whitespace", async () => {
      let callCount = 0
      const mockQueryClient = {
        ensureQueryData: async () => {
          callCount++
          return {}
        },
      }

      await loader({
        context: { queryClient: mockQueryClient },
        deps: {},
      })
      expect(callCount).toBe(0)

      await loader({
        context: { queryClient: mockQueryClient },
        deps: { id: "" },
      })
      expect(callCount).toBe(0)

      await loader({
        context: { queryClient: mockQueryClient },
        deps: { id: "   " },
      })
      expect(callCount).toBe(0)
    })
  })
})
