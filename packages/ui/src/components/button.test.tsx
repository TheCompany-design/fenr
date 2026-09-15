import { describe, expect, it } from "bun:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { Button } from "./button"

describe("Button component", () => {
  it("renders a standard button by default", () => {
    const html = renderToStaticMarkup(
      createElement(Button, { type: "button" }, "Click me"),
    )
    expect(html).toContain("<button")
    expect(html).toContain("Click me")
  })

  it("renders asChild when given a single valid React element", () => {
    const html = renderToStaticMarkup(
      createElement(
        Button,
        { asChild: true },
        createElement("a", { href: "/test" }, "Link button"),
      ),
    )
    expect(html).toContain("<a")
    expect(html).toContain('href="/test"')
    expect(html).toContain("Link button")
    expect(html).not.toContain("<button")
  })

  it("throws an error when asChild is true but children is not a single valid React element", () => {
    expect(() => {
      renderToStaticMarkup(
        createElement(Button, { asChild: true }, "Text only child"),
      )
    }).toThrow("Button with 'asChild' requires a single valid React element")
  })
})
