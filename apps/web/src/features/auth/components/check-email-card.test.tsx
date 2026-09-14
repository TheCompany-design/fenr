import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test"
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router"
import { GlobalWindow } from "happy-dom"
import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import { renderToStaticMarkup } from "react-dom/server"

const mockMagicLink = mock(
  async (_opts: {
    email: string
    callbackURL?: string
  }): Promise<{
    data: { status: boolean } | null
    error: { message?: string } | null
  }> => ({
    data: { status: true },
    error: null,
  }),
)

mock.module("@/lib/auth-client", () => ({
  authClient: {
    signIn: {
      magicLink: mockMagicLink,
    },
  },
}))

import { CheckEmailCard } from "./check-email-card"
import { MagicLinkForm } from "./magic-link-form"

// Setup DOM globals for interactive tests
const originalWindow = globalThis.window
const originalDocument = globalThis.document
const originalNavigator = globalThis.navigator
const originalElement = globalThis.Element
const originalHTMLElement = globalThis.HTMLElement
const originalNode = globalThis.Node
const originalCustomElements = globalThis.customElements

if (typeof window === "undefined") {
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
}

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

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

async function renderWithRouter(component: () => React.ReactNode) {
  const rootRoute = createRootRoute({ component })
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory(),
  })
  await router.load()
  return renderToStaticMarkup(createElement(RouterProvider, { router }))
}

async function mountWithRouter(component: () => React.ReactNode) {
  const rootRoute = createRootRoute({ component })
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory(),
  })
  await router.load()

  const container = document.createElement("div")
  document.body.appendChild(container)
  const root = createRoot(container)

  await act(async () => {
    root.render(createElement(RouterProvider, { router }))
  })

  return {
    container,
    router,
    unmount: () => {
      act(() => {
        root.unmount()
      })
      container.remove()
    },
  }
}

function getResendButton(container: HTMLElement) {
  const buttons = Array.from(container.querySelectorAll("button"))
  return buttons.find(
    (btn) =>
      btn.textContent?.includes("Resend") ||
      btn.textContent?.includes("Sending"),
  )
}

describe("Auth UI Components", () => {
  beforeEach(() => {
    mockMagicLink.mockReset()
    mockMagicLink.mockResolvedValue({
      data: { status: true },
      error: null,
    })
  })

  describe("CheckEmailCard", () => {
    it("renders email address, instructions, and semantic design tokens", async () => {
      const html = await renderWithRouter(() =>
        createElement(CheckEmailCard, {
          email: "target@example.com",
        }),
      )

      expect(html).toContain("target@example.com")
      expect(html).toContain("Check your inbox.")
      expect(html).toContain("Magic link sent")
      expect(html).toContain("Open mail app")
      expect(html).toContain("10 minutes")
      expect(html).toContain("Resend in 60s")
      // Restored visual polish tokens: emerald success badge & support contact link
      expect(html).toContain(
        "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
      )
      expect(html).toContain("mailto:support@fenr.app")
      expect(html).toContain("contact support")
    })

    it("renders accessible error recovery banner when errorReason is provided", async () => {
      const html = await renderWithRouter(() =>
        createElement(CheckEmailCard, {
          email: "expired@example.com",
          errorReason: "invalid_token",
        }),
      )

      expect(html).toContain('role="alert"')
      expect(html).toContain('aria-live="polite"')
      expect(html).toContain("Sign-in link expired or invalid")
      expect(html).toContain(
        "The sign-in link you clicked has expired or was already used.",
      )
      // When error is present, cooldown is 0 so button is immediately "Resend link"
      expect(html).toContain("Resend link")
      // Recovery copy rather than "Magic link sent" / "Check your inbox."
      expect(html).toContain("Link expired or invalid")
      expect(html).toContain("Request a new link.")
      expect(html).toContain("Your previous sign-in link is no longer valid")
      expect(html).not.toContain("Magic link sent")
    })

    it("renders 'Use a different email' TanStack Router Link with redirect destination", async () => {
      const html = await renderWithRouter(() =>
        createElement(CheckEmailCard, {
          email: "test@example.com",
          redirectTo: "/dashboard",
        }),
      )

      expect(html).toContain("Use a different email")
      expect(html).toContain('href="/auth/sign-in?redirect=%2Fdashboard"')
    })

    it("renders clean fallback link when redirectTo is default root", async () => {
      const html = await renderWithRouter(() =>
        createElement(CheckEmailCard, {
          email: "test@example.com",
          redirectTo: "/",
        }),
      )

      expect(html).toContain("Use a different email")
      expect(html).toContain('href="/auth/sign-in"')
    })

    it("invokes authClient.signIn.magicLink on resend click", async () => {
      const mounted = await mountWithRouter(() =>
        createElement(CheckEmailCard, {
          email: "test@example.com",
          redirectTo: "/welcome",
          errorReason: "session_expired",
        }),
      )

      const button = getResendButton(mounted.container)
      expect(button).toBeDefined()
      expect(button?.textContent).toContain("Resend link")

      await act(async () => {
        button?.click()
      })

      expect(mockMagicLink).toHaveBeenCalledTimes(1)
      expect(mockMagicLink).toHaveBeenCalledWith({
        email: "test@example.com",
        callbackURL: "/welcome",
      })

      mounted.unmount()
    })

    it("guards against double-click concurrency race (only 1 magicLink call)", async () => {
      let resolveMagicLink: (value: {
        data: { status: boolean } | null
        error: { message?: string } | null
      }) => void = () => {}
      const pendingPromise = new Promise<{
        data: { status: boolean } | null
        error: { message?: string } | null
      }>((resolve) => {
        resolveMagicLink = resolve
      })

      mockMagicLink.mockImplementation(() => pendingPromise)

      const mounted = await mountWithRouter(() =>
        createElement(CheckEmailCard, {
          email: "race@example.com",
          errorReason: "invalid_token",
        }),
      )

      const button = getResendButton(mounted.container)
      expect(button).toBeDefined()

      // First click begins resend
      await act(async () => {
        button?.click()
      })
      expect(mockMagicLink).toHaveBeenCalledTimes(1)
      expect(button?.textContent).toContain("Sending…")
      expect(button?.hasAttribute("disabled")).toBe(true)

      // Second rapid click while still in flight should be locked out
      await act(async () => {
        button?.click()
      })
      expect(mockMagicLink).toHaveBeenCalledTimes(1)

      // Resolve the in-flight promise
      await act(async () => {
        resolveMagicLink({ data: { status: true }, error: null })
      })

      mounted.unmount()
    })

    it("transitions to 'Sent again · 1' and dismisses error banner on resend", async () => {
      const mounted = await mountWithRouter(() =>
        createElement(CheckEmailCard, {
          email: "recovery@example.com",
          errorReason: "invalid_token",
        }),
      )

      // Initially error banner is present and copy is for recovery
      expect(mounted.container.querySelector('[role="alert"]')).not.toBeNull()
      expect(mounted.container.textContent).toContain(
        "Sign-in link expired or invalid",
      )
      expect(mounted.container.textContent).toContain("Request a new link.")
      expect(mounted.container.textContent).not.toContain("Sent again · 1")

      const button = getResendButton(mounted.container)
      await act(async () => {
        button?.click()
      })

      // Error banner is dismissed
      expect(mounted.container.querySelector('[role="alert"]')).toBeNull()
      expect(mounted.container.textContent).not.toContain(
        "Sign-in link expired or invalid",
      )
      // Heading updates
      expect(mounted.container.textContent).toContain("Check your inbox.")
      expect(mounted.container.textContent).toContain("Magic link sent")
      // Badge with role="status" and aria-live="polite" is present
      const badge = mounted.container.querySelector('[role="status"]')
      expect(badge).not.toBeNull()
      expect(badge?.getAttribute("aria-live")).toBe("polite")
      expect(badge?.textContent).toContain("Sent again · 1")

      mounted.unmount()
    })

    it("keeps button disabled while in cooldown", async () => {
      // Initially without errorReason, cooldown is active (60s)
      const mounted = await mountWithRouter(() =>
        createElement(CheckEmailCard, {
          email: "cooldown@example.com",
        }),
      )

      const button = getResendButton(mounted.container)
      expect(button).toBeDefined()
      expect(button?.hasAttribute("disabled")).toBe(true)
      expect(button?.textContent).toContain("Resend in 60s")

      // Attempted click while in cooldown is blocked
      await act(async () => {
        button?.click()
      })
      expect(mockMagicLink).toHaveBeenCalledTimes(0)

      mounted.unmount()
    })
  })

  describe("MagicLinkForm", () => {
    it("renders email input with label, placeholder, accessibility attributes, and submit button", async () => {
      const html = await renderWithRouter(() =>
        createElement(MagicLinkForm, {
          redirectTo: "/dashboard",
          defaultEmail: "prefill@example.com",
        }),
      )

      expect(html).toContain('id="magic-link-email"')
      expect(html).toContain('type="email"')
      expect(html).toContain("Continue with email")
      expect(html).toContain("prefill@example.com")
      expect(html).toContain("you@example.com")
      expect(html).toContain('for="magic-link-email"')
    })
  })
})
