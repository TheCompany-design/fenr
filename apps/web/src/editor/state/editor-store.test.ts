import { describe, expect, it } from "bun:test"
import { createStore } from "jotai"
import {
  DEFAULT_FORMATTING_STATE,
  DEFAULT_SELECTION_STATE,
  formattingAtom,
  isBoldAtom,
  isSelectionEmptyAtom,
  selectionAtom,
  textTypeAtom,
} from "./atoms"

describe("Editor Store Isolation", () => {
  it("initializes stores with default formatting and selection", () => {
    const store = createStore()
    expect(store.get(formattingAtom)).toEqual(DEFAULT_FORMATTING_STATE)
    expect(store.get(isBoldAtom)).toBe(false)
    expect(store.get(textTypeAtom)).toBe("text")
    expect(store.get(selectionAtom)).toEqual(DEFAULT_SELECTION_STATE)
    expect(store.get(isSelectionEmptyAtom)).toBe(true)
  })

  it("mutations in Store A do not affect Store B", () => {
    const storeA = createStore()
    const storeB = createStore()

    storeA.set(formattingAtom, {
      ...DEFAULT_FORMATTING_STATE,
      isBold: true,
      textType: "heading-1",
    })

    storeA.set(selectionAtom, {
      from: 10,
      to: 20,
      empty: false,
    })

    // Store A is updated
    expect(storeA.get(formattingAtom).isBold).toBe(true)
    expect(storeA.get(isBoldAtom)).toBe(true)
    expect(storeA.get(textTypeAtom)).toBe("heading-1")
    expect(storeA.get(selectionAtom)).toEqual({
      from: 10,
      to: 20,
      empty: false,
    })
    expect(storeA.get(isSelectionEmptyAtom)).toBe(false)

    // Store B remains at defaults
    expect(storeB.get(formattingAtom).isBold).toBe(false)
    expect(storeB.get(isBoldAtom)).toBe(false)
    expect(storeB.get(textTypeAtom)).toBe("text")
    expect(storeB.get(selectionAtom)).toEqual(DEFAULT_SELECTION_STATE)
    expect(storeB.get(isSelectionEmptyAtom)).toBe(true)
  })
})
