import { afterEach, describe, expect, it } from "bun:test"
import { createElement, isValidElement, type ReactElement } from "react"
import {
  type ReferenceableItem,
  referenceItems,
  setReferenceableItems,
} from "./sources"

describe("referenceItems", () => {
  afterEach(() => {
    // The referenceable list is module state; leaving items behind would
    // leak into every other test that reads the `@` menu.
    setReferenceableItems([])
  })

  function integration(
    overrides: Partial<ReferenceableItem> = {},
  ): ReferenceableItem {
    return {
      id: "integration:slack",
      label: "Slack",
      hint: "Send a message to a channel",
      insertText: "@Slack",
      toolkitSlug: "slack",
      connectionBadge: "connected",
      ...overrides,
    }
  }

  it("marks toolkit items as integration suggestions", () => {
    setReferenceableItems([integration()])

    const items = referenceItems()
    expect(items).toHaveLength(1)
    expect(items[0].id).toBe("integration:slack")
    expect(items[0].insertText).toBe("@Slack")
    expect(items[0].hint).toBe("Send a message to a channel")
  })

  it("drops host items that are not app integrations", () => {
    setReferenceableItems([
      { id: "doc-1", label: "Handbook", insertText: "@Handbook" },
      integration(),
    ])

    const items = referenceItems()
    expect(items).toHaveLength(1)
    expect(items[0].id).toBe("integration:slack")
  })

  it("passes the host's icon through untouched", () => {
    const icon = createElement("img", { src: "logo.svg", alt: "" })
    setReferenceableItems([integration({ icon })])

    const [item] = referenceItems()
    expect(item.icon).toBe(icon)
  })

  it("carries the brand data the mention pill is drawn from", () => {
    setReferenceableItems([
      integration({
        logoUrl: "https://example.test/logos/slack.svg",
        logoMonochrome: true,
        accentHex: "#4a154b",
      }),
    ])

    const [item] = referenceItems()
    expect(item.logoUrl).toBe("https://example.test/logos/slack.svg")
    expect(item.logoMonochrome).toBe(true)
    expect(item.accentHex).toBe("#4a154b")
  })

  it("renders the connection badge as a pill", () => {
    setReferenceableItems([integration({ connectionBadge: "connected" })])

    const trailing = referenceItems()[0].trailing
    expect(isValidElement(trailing)).toBe(true)
    if (!isValidElement(trailing)) return
    const badge = trailing as ReactElement<{
      children?: string
      className?: string
    }>
    expect(badge.props.children).toBe("connected")
    expect(badge.props.className).toContain("rounded-full")
  })

  it("omits the badge when the host sends no connection state", () => {
    setReferenceableItems([integration({ connectionBadge: undefined })])

    expect(referenceItems()[0].trailing).toBeUndefined()
  })
})
