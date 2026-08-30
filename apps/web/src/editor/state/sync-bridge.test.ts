import { describe, expect, it } from "bun:test"
import type { Editor } from "@tiptap/react"
import { DEFAULT_BUBBLE_MENU_FORMATTING } from "./atoms"
import { areStatesEqual, deriveFormattingSnapshot } from "./sync-bridge"

const createMockEditor = (
  activeMap: Record<string, boolean> = {},
  destroyed = false,
): Editor => {
  return {
    isDestroyed: destroyed,
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
    expect(snapshot).toEqual(DEFAULT_BUBBLE_MENU_FORMATTING)
  })

  it("returns default formatting when editor is destroyed", () => {
    const mock = createMockEditor({ bold: true }, true)
    const snapshot = deriveFormattingSnapshot(mock)
    expect(snapshot).toEqual(DEFAULT_BUBBLE_MENU_FORMATTING)
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

describe("areStatesEqual", () => {
  it("returns true for identical states", () => {
    const stateA = { ...DEFAULT_BUBBLE_MENU_FORMATTING }
    const stateB = { ...DEFAULT_BUBBLE_MENU_FORMATTING }
    expect(areStatesEqual(stateA, stateB)).toBe(true)
  })

  it("returns false when any property differs", () => {
    const stateA = { ...DEFAULT_BUBBLE_MENU_FORMATTING }
    const stateB = { ...DEFAULT_BUBBLE_MENU_FORMATTING, isBold: true }
    expect(areStatesEqual(stateA, stateB)).toBe(false)
  })
})
