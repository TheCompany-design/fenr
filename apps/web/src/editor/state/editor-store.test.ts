import { describe, expect, it } from "bun:test"
import { createStore } from "jotai"
import {
  bubbleMenuFormattingAtom,
  DEFAULT_BUBBLE_MENU_FORMATTING,
  isBoldAtom,
  textTypeAtom,
} from "./atoms"

describe("Editor Store Isolation", () => {
  it("initializes stores with default formatting", () => {
    const store = createStore()
    expect(store.get(bubbleMenuFormattingAtom)).toEqual(
      DEFAULT_BUBBLE_MENU_FORMATTING,
    )
    expect(store.get(isBoldAtom)).toBe(false)
    expect(store.get(textTypeAtom)).toBe("text")
  })

  it("mutations in Store A do not affect Store B", () => {
    const storeA = createStore()
    const storeB = createStore()

    storeA.set(bubbleMenuFormattingAtom, {
      ...DEFAULT_BUBBLE_MENU_FORMATTING,
      isBold: true,
      textType: "heading-1",
    })

    // Store A is updated
    expect(storeA.get(bubbleMenuFormattingAtom).isBold).toBe(true)
    expect(storeA.get(isBoldAtom)).toBe(true)
    expect(storeA.get(textTypeAtom)).toBe("heading-1")

    // Store B remains at defaults
    expect(storeB.get(bubbleMenuFormattingAtom).isBold).toBe(false)
    expect(storeB.get(isBoldAtom)).toBe(false)
    expect(storeB.get(textTypeAtom)).toBe("text")
  })
})
