import { describe, expect, it } from "bun:test"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createElement, type ReactElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { AuthDivider } from "./auth-divider"
import { AuthMethods } from "./auth-methods"

describe("Auth Composition Components", () => {
  describe("AuthDivider Component", () => {
    it("renders default divider label", () => {
      const html = renderToStaticMarkup(createElement(AuthDivider))
      expect(html).toContain("Or continue with")
    })

    it("renders custom divider label", () => {
      const html = renderToStaticMarkup(
        createElement(AuthDivider, { label: "Or register with" }),
      )
      expect(html).toContain("Or register with")
    })
  })

  describe("AuthMethods Composite Component", () => {
    const renderWithQueryClient = (component: ReactElement) => {
      const client = new QueryClient()
      return renderToStaticMarkup(
        createElement(QueryClientProvider, { client }, component),
      )
    }

    it("composes magic-link form, divider, and oauth buttons", () => {
      const html = renderWithQueryClient(
        createElement(AuthMethods, { redirectTo: "/dashboard" }),
      )

      // Magic link form elements
      expect(html).toContain("Continue with email")
      expect(html).toContain('type="email"')

      // Divider
      expect(html).toContain("Or continue with")

      // Social OAuth buttons
      expect(html).toContain("Google")
      expect(html).toContain("Apple")
      expect(html).toContain("GitHub")
    })

    it("supports custom divider label in composition", () => {
      const html = renderWithQueryClient(
        createElement(AuthMethods, {
          redirectTo: "/dashboard",
          dividerLabel: "Alternative sign-in",
        }),
      )
      expect(html).toContain("Alternative sign-in")
    })
  })
})
