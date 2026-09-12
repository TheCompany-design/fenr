import { describe, expect, it } from "bun:test"
import type { Editor } from "@tiptap/react"
import { DEFAULT_FORMATTING_STATE, DEFAULT_SELECTION_STATE } from "./atoms"
import {
  areFormattingStatesEqual,
  areSelectionStatesEqual,
  areStatesEqual,
  deriveFormattingSnapshot,
  deriveSelectionSnapshot,
} from "./sync-bridge"

const createMockEditor = (
  activeMap: Record<string, boolean> = {},
  destroyed = false,
  selection = { from: 0, to: 0, empty: true },
): Editor => {
  return {
    isDestroyed: destroyed,
    state: {
      selection,
    },
    isActive: (name: unknown, attrs?: Record<string, unknown>) => {
      if (typeof name === "string") {
        if (attrs && "level" in attrs) {
          return activeMap[`${name}-${attrs.level}`] ?? false
        }
        return activeMap[name] ?? false
      }
      if (name && typeof name === "object" && "textAlign" in name) {
        const align = (name as { textAlign: string }).textAlign
        return activeMap[`textAlign-${align}`] ?? false
      }
      return false
    },
  } as unknown as Editor
}

describe("deriveFormattingSnapshot", () => {
  it("returns default formatting when editor is null", () => {
    const snapshot = deriveFormattingSnapshot(null)
    expect(snapshot).toEqual(DEFAULT_FORMATTING_STATE)
  })

  it("returns default formatting when editor is destroyed", () => {
    const mock = createMockEditor({ bold: true }, true)
    const snapshot = deriveFormattingSnapshot(mock)
    expect(snapshot).toEqual(DEFAULT_FORMATTING_STATE)
  })

  it("detects active marks like bold, italic, and strike", () => {
    const mock = createMockEditor({
      bold: true,
      italic: true,
      strike: true,
    })
    const snapshot = deriveFormattingSnapshot(mock)
    expect(snapshot.isBold).toBe(true)
    expect(snapshot.isItalic).toBe(true)
    expect(snapshot.isStrikethrough).toBe(true)
    expect(snapshot.textType).toBe("text")
  })

  it("detects heading levels", () => {
    const h1 = createMockEditor({ "heading-1": true })
    expect(deriveFormattingSnapshot(h1).textType).toBe("heading-1")

    const h2 = createMockEditor({ "heading-2": true })
    expect(deriveFormattingSnapshot(h2).textType).toBe("heading-2")

    const h3 = createMockEditor({ "heading-3": true })
    expect(deriveFormattingSnapshot(h3).textType).toBe("heading-3")
  })

  it("detects text alignment", () => {
    const center = createMockEditor({ "textAlign-center": true })
    const centerSnap = deriveFormattingSnapshot(center)
    expect(centerSnap.isAlignCenter).toBe(true)
    expect(centerSnap.isAlignLeft).toBe(false)

    const right = createMockEditor({ "textAlign-right": true })
    const rightSnap = deriveFormattingSnapshot(right)
    expect(rightSnap.isAlignRight).toBe(true)
    expect(rightSnap.isAlignLeft).toBe(false)

    const justify = createMockEditor({ "textAlign-justify": true })
    const justifySnap = deriveFormattingSnapshot(justify)
    expect(justifySnap.isAlignJustify).toBe(true)
    expect(justifySnap.isAlignLeft).toBe(false)

    // Defaults to left when no alignment is set
    const none = createMockEditor({})
    const noneSnap = deriveFormattingSnapshot(none)
    expect(noneSnap.isAlignLeft).toBe(true)
  })

  it("detects lists, code blocks, blockquotes, and math", () => {
    const mock = createMockEditor({
      blockquote: true,
      bulletList: true,
      orderedList: true,
      code: true,
      codeBlock: true,
      inlineMath: true,
    })

    const snapshot = deriveFormattingSnapshot(mock)
    expect(snapshot.isBlockquote).toBe(true)
    expect(snapshot.isBulletList).toBe(true)
    expect(snapshot.isOrderedList).toBe(true)
    expect(snapshot.isCode).toBe(true)
    expect(snapshot.isCodeBlock).toBe(true)
    expect(snapshot.isMath).toBe(true)
  })
})

describe("deriveSelectionSnapshot", () => {
  it("returns default selection when editor is null or destroyed", () => {
    expect(deriveSelectionSnapshot(null)).toEqual(DEFAULT_SELECTION_STATE)
    const destroyed = createMockEditor({}, true)
    expect(deriveSelectionSnapshot(destroyed)).toEqual(DEFAULT_SELECTION_STATE)
  })

  it("extracts selection ranges correctly", () => {
    const mock = createMockEditor({}, false, { from: 5, to: 12, empty: false })
    const snapshot = deriveSelectionSnapshot(mock)
    expect(snapshot).toEqual({ from: 5, to: 12, empty: false })
  })
})

describe("areStatesEqual and areSelectionStatesEqual", () => {
  it("returns true for identical formatting states", () => {
    const stateA = { ...DEFAULT_FORMATTING_STATE }
    const stateB = { ...DEFAULT_FORMATTING_STATE }
    expect(areStatesEqual(stateA, stateB)).toBe(true)
    expect(areFormattingStatesEqual(stateA, stateB)).toBe(true)
  })

  it("returns false when any formatting property differs", () => {
    const stateA = { ...DEFAULT_FORMATTING_STATE }
    const stateB = { ...DEFAULT_FORMATTING_STATE, isBold: true }
    expect(areStatesEqual(stateA, stateB)).toBe(false)
  })

  it("compares selection states accurately", () => {
    expect(
      areSelectionStatesEqual(
        { from: 1, to: 4, empty: false },
        { from: 1, to: 4, empty: false },
      ),
    ).toBe(true)

    expect(
      areSelectionStatesEqual(
        { from: 1, to: 4, empty: false },
        { from: 1, to: 5, empty: false },
      ),
    ).toBe(false)
  })
})
