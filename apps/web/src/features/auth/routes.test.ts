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

// Import routes after mock.module so they use the mocked session
const { Route: AuthParentRoute } = await import("@/routes/auth/route")
const { Route: AuthIndexRoute } = await import("@/routes/auth/index")
const { Route: CheckEmailRoute } = await import(
  "@/routes/auth/check-email/index"
)

type BeforeLoadCaller = (opts: {
  search: Record<string, unknown>
}) => Promise<unknown>

describe("Auth Route Guards & Loaders", () => {
  describe("Parent /auth Layout Route", () => {
    it("bounces authenticated users preserving intended deep-link redirect", async () => {
      currentSession = {
        session: { id: "s1" },
        user: { id: "u1", email: "user@example.com" },
      }

      let thrownRedirect: unknown = null
      try {
        const beforeLoad = AuthParentRoute.options.beforeLoad
        if (beforeLoad) {
          await (beforeLoad as unknown as BeforeLoadCaller)({
            search: { redirect: "/document/doc-456" },
          })
        }
      } catch (e) {
        thrownRedirect = e
      }

      expect(isRedirect(thrownRedirect)).toBe(true)
      expect(
        (thrownRedirect as { headers?: Headers }).headers?.get("location"),
      ).toBe("/document/doc-456")
    })

    it("allows unauthenticated visitors to proceed", async () => {
      currentSession = null

      const beforeLoad = AuthParentRoute.options.beforeLoad
      if (beforeLoad) {
        await (beforeLoad as unknown as BeforeLoadCaller)({ search: {} })
      }
      expect(true).toBe(true)
    })
  })

  describe("/auth Index Route", () => {
    it("redirects /auth to /auth/sign-in preserving search params", async () => {
      let thrownRedirect: unknown = null
      try {
        const beforeLoad = AuthIndexRoute.options.beforeLoad
        if (beforeLoad) {
          await (beforeLoad as unknown as BeforeLoadCaller)({
            search: { redirect: "/settings", error: "session_expired" },
          })
        }
      } catch (e) {
        thrownRedirect = e
      }

      expect(isRedirect(thrownRedirect)).toBe(true)
      const redirectOptions = (
        thrownRedirect as {
          options?: { to?: string; search?: Record<string, string> }
        }
      ).options
      expect(redirectOptions?.to).toBe("/auth/sign-in")
      expect(redirectOptions?.search).toEqual({
        redirect: "/settings",
        error: "session_expired",
      })
    })
  })

  describe("/auth/check-email Route", () => {
    it("redirects missing email to /auth/sign-in preserving error and redirect", async () => {
      currentSession = null

      let thrownRedirect: unknown = null
      try {
        const beforeLoad = CheckEmailRoute.options.beforeLoad
        if (beforeLoad) {
          await (beforeLoad as unknown as BeforeLoadCaller)({
            search: {
              email: "",
              error: "invalid_token",
              redirect: "/dashboard",
            },
          })
        }
      } catch (e) {
        thrownRedirect = e
      }

      expect(isRedirect(thrownRedirect)).toBe(true)
      const redirectOptions = (
        thrownRedirect as {
          options?: { to?: string; search?: Record<string, string> }
        }
      ).options
      expect(redirectOptions?.to).toBe("/auth/sign-in")
      expect(redirectOptions?.search).toEqual({
        redirect: "/dashboard",
        error: "invalid_token",
      })
    })

    it("allows valid email request through to check-email screen", async () => {
      currentSession = null

      const beforeLoad = CheckEmailRoute.options.beforeLoad
      if (beforeLoad) {
        await (beforeLoad as unknown as BeforeLoadCaller)({
          search: {
            email: "member@example.com",
            redirect: "/dashboard",
          },
        })
      }
      expect(true).toBe(true)
    })
  })
})
