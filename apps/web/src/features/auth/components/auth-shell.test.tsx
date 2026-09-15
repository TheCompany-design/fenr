import { describe, expect, it } from "bun:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { AuthHeader, AuthShell } from "./auth-shell"

describe("AuthShell Component", () => {
  it("renders branding header, atmospheric lighting, and bottom quote structure", () => {
    const html = renderToStaticMarkup(
      createElement(
        AuthShell,
        {
          tagline: "A quiet workspace for focused work.",
        },
        createElement("div", { id: "test-child" }, "Child Content"),
      ),
    )

    // Brand header
    expect(html).toContain("Fenr")
    expect(html).toContain("tracking-[0.2em]")
    expect(html).toContain("size-2 rounded-full bg-foreground")

    // Atmospheric lighting & grid
    expect(html).toContain("auth-radial-glow")
    expect(html).toContain("auth-grid-pattern")
    expect(html).toContain("blur-3xl")

    // Bottom quote and default eyebrow
    expect(html).toContain("Workspace")
    expect(html).toContain("tracking-[0.3em]")
    expect(html).toContain("A quiet workspace for focused work.")

    // Right container padding and child
    expect(html).toContain("lg:w-[620px]")
    expect(html).toContain('id="test-child"')
    expect(html).toContain("Child Content")
  })

  it("supports custom eyebrow and quoteEyebrow props", () => {
    const html = renderToStaticMarkup(
      createElement(
        AuthShell,
        {
          eyebrow: "CustomBrand",
          quoteEyebrow: "Platform Vision",
          tagline: "Custom tagline text.",
        },
        createElement("span", null, "Inner"),
      ),
    )

    expect(html).toContain("CustomBrand")
    expect(html).toContain("Platform Vision")
    expect(html).toContain("Custom tagline text.")
  })

  it("renders AuthHeader with title and description", () => {
    const html = renderToStaticMarkup(
      createElement(AuthHeader, {
        title: "Test Header",
        description: "Test Description",
      }),
    )

    expect(html).toContain("Test Header")
    expect(html).toContain("Test Description")
    expect(html).toContain("font-heading text-3xl")
  })
})
