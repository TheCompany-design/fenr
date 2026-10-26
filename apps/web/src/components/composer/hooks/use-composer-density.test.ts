import { describe, expect, it } from "bun:test"
import { measurePillOverflow } from "./use-composer-density"

const INSETS = { left: "2.75rem", right: "13rem" }
const LINE = 26

const PANEL_PADDING = { top: "12px", bottom: "4px" }

type FakeTextarea = HTMLTextAreaElement & {
  writes: string[]

  enterPanel: () => void
}

function fakeTextarea(contentHeight: number): FakeTextarea {
  const state = {
    maxHeight: "",
    paddingTop: "",
    paddingBottom: "",
    paddingLeft: "",
    paddingRight: "",
  }
  const writes: string[] = []
  const px = (value: string) => (value ? Number.parseFloat(value) || 0 : 0)

  const element = {
    writes,
    style: new Proxy(state, {
      set(target, key: string, value: string) {
        target[key as keyof typeof target] = value
        writes.push(`${key}=${value}`)
        return true
      },
    }),
    // The content never changes; only the box around it does.
    get scrollHeight() {
      return contentHeight + px(state.paddingTop) + px(state.paddingBottom)
    },
    get clientHeight() {
      const clamp = state.maxHeight === "1lh" ? LINE : Number.POSITIVE_INFINITY
      return Math.min(this.scrollHeight, clamp)
    },
    enterPanel: () => {
      state.maxHeight = ""
      state.paddingTop = PANEL_PADDING.top
      state.paddingBottom = PANEL_PADDING.bottom
    },
  }

  return element as unknown as FakeTextarea
}

describe("measurePillOverflow", () => {
  it("reports a draft that fits one line as fitting", () => {
    expect(measurePillOverflow(fakeTextarea(LINE), INSETS)).toBe(false)
  })

  it("reports a wrapped draft as outgrown", () => {
    expect(measurePillOverflow(fakeTextarea(LINE * 2), INSETS)).toBe(true)
  })

  it("applies the pill's own geometry while it measures", () => {
    const textarea = fakeTextarea(LINE * 2)
    measurePillOverflow(textarea, INSETS)
    expect(textarea.writes).toContain("maxHeight=1lh")
    expect(textarea.writes).toContain("paddingTop=0px")
    expect(textarea.writes).toContain("paddingBottom=0px")
    expect(textarea.writes).toContain(`paddingLeft=${INSETS.left}`)
    expect(textarea.writes).toContain(`paddingRight=${INSETS.right}`)
  })

  it("hands the element back as it found it", () => {
    const textarea = fakeTextarea(LINE * 2)
    textarea.enterPanel()
    textarea.style.paddingLeft = "12px"
    textarea.style.paddingRight = "12px"

    measurePillOverflow(textarea, INSETS)

    expect(textarea.style.maxHeight).toBe("")
    expect(textarea.style.paddingTop).toBe(PANEL_PADDING.top)
    expect(textarea.style.paddingBottom).toBe(PANEL_PADDING.bottom)
    expect(textarea.style.paddingLeft).toBe("12px")
    expect(textarea.style.paddingRight).toBe("12px")
  })

  it("leaves an element it was given empty, empty", () => {
    const textarea = fakeTextarea(LINE)
    measurePillOverflow(textarea, INSETS)

    expect(textarea.style.maxHeight).toBe("")
    expect(textarea.style.paddingTop).toBe("")
    expect(textarea.style.paddingBottom).toBe("")
    expect(textarea.style.paddingLeft).toBe("")
    expect(textarea.style.paddingRight).toBe("")
  })

  it("sees a wrapped draft as wrapped from an unclamped panel too", () => {
    // The failure this guards against: measured in the panel's own geometry a
    // two-line draft fits, so the box would collapse, re-wrap, and oscillate on
    // every keystroke.
    const fromPanel = fakeTextarea(LINE * 2)
    fromPanel.enterPanel()
    expect(fromPanel.clientHeight).toBe(LINE * 2 + 16)

    expect(measurePillOverflow(fromPanel, INSETS)).toBe(true)
    expect(fromPanel.clientHeight).toBe(LINE * 2 + 16)
  })

  it("does not read the panel's padding as a second line", () => {
    // 26px of text plus `pt-3 pb-1` is 42px of box, which is one line's worth
    // of padding and no text at all. Counting it would mean a comfortable
    // one-line draft could never collapse back.
    const fromPanel = fakeTextarea(LINE)
    fromPanel.enterPanel()
    expect(fromPanel.scrollHeight).toBe(LINE + 16)

    expect(measurePillOverflow(fromPanel, INSETS)).toBe(false)
  })

  it("gives the same answer from either density", () => {
    const fromPill = fakeTextarea(LINE * 2)
    const fromPanel = fakeTextarea(LINE * 2)
    fromPanel.enterPanel()

    expect(measurePillOverflow(fromPill, INSETS)).toBe(
      measurePillOverflow(fromPanel, INSETS),
    )
  })

  it("repeats without drift, so a re-measure cannot walk the answer", () => {
    const textarea = fakeTextarea(LINE * 2)
    textarea.enterPanel()

    const answers = [1, 2, 3].map(() => measurePillOverflow(textarea, INSETS))
    expect(answers).toEqual([true, true, true])
  })
})
