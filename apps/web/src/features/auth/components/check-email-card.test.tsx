import { describe, expect, it } from "bun:test"
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { CheckEmailCard } from "./check-email-card"
import { MagicLinkForm } from "./magic-link-form"

async function renderWithRouter(component: () => React.ReactNode) {
  const rootRoute = createRootRoute({ component })
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory(),
  })
  await router.load()
  return renderToStaticMarkup(createElement(RouterProvider, { router }))
}

describe("Auth UI Components", () => {
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
      expect(html).toContain("Resend link in 60s")
      // Semantic tokens check — no hardcoded emerald classes
      expect(html).toContain("bg-primary/10 text-primary")
      expect(html).not.toContain("emerald")
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
