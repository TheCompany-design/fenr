import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import type { AppMentionApp } from "./app-mention-pill"

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

const { act, createElement } = await import("react")
const { createRoot } = await import("react-dom/client")
const { MessageMarkdown } = await import("./message-markdown")

const APPS: AppMentionApp[] = [
  {
    slug: "slack",
    name: "Slack",
    logoUrl: "https://example.test/logos/slack.svg",
    accentHex: "#4a154b",
    monochrome: false,
  },
  {
    slug: "google-calendar",
    name: "Google Calendar",
    logoUrl: "https://example.test/logos/google-calendar.svg",
    accentHex: null,
    monochrome: true,
  },
  {
    slug: "google",
    name: "Google",
    logoUrl: "https://example.test/logos/google.svg",
    accentHex: null,
    monochrome: false,
  },
]

describe("MessageMarkdown app mentions", () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    try {
      act(() => root.unmount())
    } catch {}
    container.remove()
  })

  function render(content: string, withApps: boolean) {
    act(() => {
      root.render(
        createElement(MessageMarkdown, {
          content,
          variant: "user",
          ...(withApps ? { appMentions: APPS } : {}),
        }),
      )
    })
  }

  function pill() {
    return container.querySelector('[data-slot="app-mention-pill"]')
  }

  it("renders a mentioned app as a pill carrying its brand data", () => {
    render("Find leads via @Slack today", true)

    const found = pill()
    expect(found).not.toBeNull()
    expect(found?.getAttribute("data-app-mention")).toBe("slack")
    expect(found?.getAttribute("data-app-name")).toBe("Slack")
    expect(found?.getAttribute("data-app-logo")).toBe(
      "https://example.test/logos/slack.svg",
    )
    expect(found?.getAttribute("data-app-accent")).toBe("#4a154b")
    expect(found?.getAttribute("style")).toContain("--mention-accent")
    expect(found?.textContent).toContain("Slack")
    const icon = found?.querySelector("img")
    expect(icon?.getAttribute("src")).toBe(
      "https://example.test/logos/slack.svg",
    )
  })

  it("leaves the text alone when no registry is given", () => {
    render("Find leads via @Slack today", false)

    expect(pill()).toBeNull()
    expect(container.textContent).toContain("@Slack")
  })

  it("leaves an @Name inside code as code", () => {
    render("run `@Slack ping` now", true)

    expect(pill()).toBeNull()
    const code = container.querySelector("code")
    expect(code?.textContent).toContain("@Slack")
  })

  it("prefers the longest name a token matches", () => {
    render("book it on @Google Calendar please", true)

    const pills = container.querySelectorAll('[data-slot="app-mention-pill"]')
    expect(pills).toHaveLength(1)
    expect(pills[0].getAttribute("data-app-mention")).toBe("google-calendar")
    expect(container.textContent).not.toContain("@Google Calendar")
    expect(container.textContent).toContain("book it on")
  })

  it("renders plain @Name as text when it names no app", () => {
    render("ask @Notion for the docs", true)

    expect(pill()).toBeNull()
    expect(container.textContent).toContain("@Notion")
  })
})
