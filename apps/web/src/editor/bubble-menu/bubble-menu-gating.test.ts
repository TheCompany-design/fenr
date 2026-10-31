import { describe, expect, it } from "bun:test"
import { HIGHLIGHT_COLOR_SWATCHES, TEXT_COLOR_SWATCHES } from "./colors"
import {
  shouldShowFormattingBubble,
  shouldShowLinkPopover,
  shouldShowTableToolbar,
} from "./should-show"

describe("color palettes", () => {
  it("keeps swatch values unique within each palette", () => {
    for (const palette of [TEXT_COLOR_SWATCHES, HIGHLIGHT_COLOR_SWATCHES]) {
      const values = palette.map((s) => s.value)
      expect(new Set(values).size).toBe(values.length)
    }
  })

  it("leads each palette with a default reset swatch", () => {
    expect(TEXT_COLOR_SWATCHES[0]?.value).toBeNull()
    expect(HIGHLIGHT_COLOR_SWATCHES[0]?.value).toBeNull()
  })

  it("mirrors Notion's ten color names in both palettes", () => {
    const labels = (palette: typeof TEXT_COLOR_SWATCHES) =>
      palette.map((s) => s.label)
    expect(labels(TEXT_COLOR_SWATCHES)).toEqual(
      labels(HIGHLIGHT_COLOR_SWATCHES),
    )
    expect(TEXT_COLOR_SWATCHES).toHaveLength(10)
  })
})

describe("shouldShowFormattingBubble", () => {
  const visible = {
    isEditable: true,
    isLinkActive: false,
    hasFocus: true,
    isEmptySelection: false,
    isEmptyTextBlock: false,
  }

  it("shows for a focused editable text selection", () => {
    expect(shouldShowFormattingBubble(visible)).toBe(true)
  })

  it("hides for collapsed or unfocused selections", () => {
    expect(
      shouldShowFormattingBubble({ ...visible, isEmptySelection: true }),
    ).toBe(false)
    expect(shouldShowFormattingBubble({ ...visible, hasFocus: false })).toBe(
      false,
    )
  })

  it("hides for read-only editors and empty text blocks", () => {
    expect(shouldShowFormattingBubble({ ...visible, isEditable: false })).toBe(
      false,
    )
    expect(
      shouldShowFormattingBubble({ ...visible, isEmptyTextBlock: true }),
    ).toBe(false)
  })

  it("yields to the link popover when the selection is inside a link", () => {
    expect(shouldShowFormattingBubble({ ...visible, isLinkActive: true })).toBe(
      false,
    )
  })
})

describe("shouldShowTableToolbar", () => {
  const visible = {
    isEditable: true,
    isActiveTable: true,
    isEmptySelection: true,
    isCellSelection: false,
  }

  it("shows for a collapsed cursor inside a table", () => {
    expect(shouldShowTableToolbar(visible)).toBe(true)
  })

  it("shows for cell-spanning selections", () => {
    expect(
      shouldShowTableToolbar({ ...visible, isEmptySelection: false, isCellSelection: true }),
    ).toBe(true)
  })

  it("hides for text selections so the formatting toolbar takes over", () => {
    expect(
      shouldShowTableToolbar({ ...visible, isEmptySelection: false, isCellSelection: false }),
    ).toBe(false)
  })

  it("hides outside tables and in read-only editors", () => {
    expect(shouldShowTableToolbar({ ...visible, isActiveTable: false })).toBe(false)
    expect(shouldShowTableToolbar({ ...visible, isEditable: false })).toBe(false)
  })
})

describe("shouldShowLinkPopover", () => {
  it("shows for a collapsed cursor inside a link", () => {
    expect(shouldShowLinkPopover({ isLinkActive: true })).toBe(true)
  })

  it("hides outside links", () => {
    expect(shouldShowLinkPopover({ isLinkActive: false })).toBe(false)
  })
})
