import { describe, expect, it } from "bun:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { AuthErrorBanner } from "./auth-error-banner"

describe("AuthErrorBanner", () => {
  it("renders nothing when neither error nor customTitle is provided", () => {
    const html = renderToStaticMarkup(
      createElement(AuthErrorBanner, { error: null }),
    )
    expect(html).toBe("")
  })

  it("renders alert role and aria-live polite attributes", () => {
    const html = renderToStaticMarkup(
      createElement(AuthErrorBanner, { error: "access_resolution_failed" }),
    )
    expect(html).toContain('role="alert"')
    expect(html).toContain('aria-live="polite"')
    expect(html).toContain("Unable to load workspace")
    expect(html).toContain(
      "We couldn&#x27;t verify your organization access. Please sign in again or check your network connection.",
    )
  })

  it("renders session expired error message", () => {
    const html = renderToStaticMarkup(
      createElement(AuthErrorBanner, { error: "session_expired" }),
    )
    expect(html).toContain("Session Expired")
    expect(html).toContain(
      "Your session has expired. Please sign in to resume your work.",
    )
  })

  it("renders custom title and description when provided", () => {
    const html = renderToStaticMarkup(
      createElement(AuthErrorBanner, {
        title: "Custom Header",
        description: "Custom detail message",
      }),
    )
    expect(html).toContain("Custom Header")
    expect(html).toContain("Custom detail message")
  })
})
