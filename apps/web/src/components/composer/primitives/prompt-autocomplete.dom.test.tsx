import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import { PromptAutocomplete } from "./prompt-autocomplete"
import type { SuggestionItem, SuggestionState } from "./suggestion"

function item(overrides: Partial<SuggestionItem> = {}): SuggestionItem {
  return {
    id: "integration:slack",
    insertText: "@Slack",
    label: "Slack",
    hint: "Send a message to a channel",
    ...overrides,
  }
}

function stateWith(items: SuggestionItem[]): SuggestionState {
  return {
    open: true,
    trigger: { kind: "mention", from: 0, to: 1, query: "" },
    anchor: { top: 0, left: 0, height: 20 },
    items,
    activeIndex: 0,
  }
}

describe("PromptAutocomplete", () => {
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

  it("renders one option per item, active first", () => {
    act(() => {
      root.render(
        createElement(PromptAutocomplete, {
          state: stateWith([item(), item({ id: "ref:1", label: "a.txt" })]),
          onSelect: () => {},
        }),
      )
    })

    const options = container.querySelectorAll('[role="option"]')
    expect(options).toHaveLength(2)
    expect(options[0].getAttribute("aria-selected")).toBe("true")
    expect(options[0].textContent).toContain("Slack")
  })

  it("scrolls through the ScrollArea viewport, not a native scrollbar", () => {
    act(() => {
      root.render(
        createElement(PromptAutocomplete, {
          state: stateWith([item()]),
          onSelect: () => {},
        }),
      )
    })

    const listbox = container.querySelector('[role="listbox"]')
    expect(listbox).not.toBeNull()
    expect(listbox?.className).not.toContain("overflow-y-auto")

    const viewport = container.querySelector(
      '[data-slot="scroll-area-viewport"]',
    )
    expect(viewport).not.toBeNull()
    expect(
      viewport?.contains(listbox?.querySelector('[role="option"]') ?? null),
    ).toBe(true)
  })

  it("renders the row icon inside the icon slot when the item carries one", () => {
    act(() => {
      root.render(
        createElement(PromptAutocomplete, {
          state: stateWith([
            item({ icon: createElement("img", { src: "logo.svg", alt: "" }) }),
          ]),
          onSelect: () => {},
        }),
      )
    })

    const icon = container.querySelector('[role="option"] img')
    expect(icon).not.toBeNull()
    expect(icon?.getAttribute("src")).toBe("logo.svg")
  })

  it("renders nothing while closed", () => {
    act(() => {
      root.render(
        createElement(PromptAutocomplete, {
          state: { ...stateWith([item()]), open: false },
          onSelect: () => {},
        }),
      )
    })

    expect(container.querySelector('[role="listbox"]')).toBeNull()
  })
})
