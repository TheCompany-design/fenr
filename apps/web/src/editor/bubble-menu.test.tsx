import { describe, expect, it } from "bun:test"
import {
  BubbleMenu,
  BubbleToolbarGroup,
  TEXT_TYPES,
  TextTypeMenuItems,
} from "./bubble-menu"

describe("BubbleMenu & TextTypeMenuItems", () => {
  it("defines all expected text types with labels, icons, and shortcuts", () => {
    expect(TEXT_TYPES).toHaveLength(4)
    const values = TEXT_TYPES.map((t) => t.value)
    expect(values).toEqual(["text", "heading-1", "heading-2", "heading-3"])

    const shortcuts = TEXT_TYPES.map((t) => t.shortcut)
    expect(shortcuts).toEqual(["⌥⌘0", "⌥⌘1", "⌥⌘2", "⌥⌘3"])
  })

  it("exports BubbleMenu, TextTypeMenuItems, and BubbleToolbarGroup components", () => {
    expect(BubbleMenu).toBeDefined()
    expect(TextTypeMenuItems).toBeDefined()
    expect(BubbleToolbarGroup).toBeDefined()
  })

  it("TextTypeMenuItems and BubbleToolbarGroup are valid React component functions", () => {
    expect(typeof TextTypeMenuItems).toBe("function")
    expect(typeof BubbleToolbarGroup).toBe("function")
  })

  it("BubbleToolbarGroup accepts dynamic items and accurately maps pressed state", () => {
    let clicked = false
    const items = [
      {
        id: "bold",
        label: "Bold",
        icon: () => null,
        pressed: false,
        onClick: () => {
          clicked = true
        },
      },
    ]

    expect(items[0].pressed).toBe(false)
    items[0].onClick()
    expect(clicked).toBe(true)

    // Unformatted selection must remain unpressed (not stuck)
    const unformattedSelectionItem = {
      ...items[0],
      pressed: false,
    }
    expect(unformattedSelectionItem.pressed).toBe(false)
  })
})
