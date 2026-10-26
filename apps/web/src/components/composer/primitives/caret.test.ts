import { afterEach, describe, expect, it } from "bun:test"
import { measureCaret } from "./caret"
import { editorScrollHost } from "./prompt-input"

const WITHIN = { top: 400, left: 24, height: 20 }
const TEXTAREA_BOX = { top: 100, left: 0 }
const SHELL_BOX = { top: 80, left: 0 }

function box(top: number, left: number, height: number, width = 10): DOMRect {
  return {
    top,
    left,
    height,
    width,
    x: left,
    y: top,
    bottom: top + height,
    right: left + width,
    toJSON: () => ({}),
  } as DOMRect
}

function editor() {
  const shell = document.createElement("div")
  shell.setAttribute("data-slot", "prompt-input")
  const viewport = document.createElement("div")
  viewport.setAttribute("data-slot", "scroll-area-viewport")
  const textarea = document.createElement("textarea")
  viewport.appendChild(textarea)
  shell.appendChild(viewport)
  document.body.appendChild(shell)
  return { shell, viewport, textarea }
}

let restore: (() => void) | null = null

function declareBoxes(viewport: HTMLElement): void {
  const descriptor = Object.getOwnPropertyDescriptor(
    Element.prototype,
    "getBoundingClientRect",
  )
  if (!descriptor) throw new Error("getBoundingClientRect has no descriptor")

  Element.prototype.getBoundingClientRect = function stubbed(this: Element) {
    if (this.tagName === "SPAN") {
      return box(WITHIN.top, WITHIN.left, WITHIN.height)
    }
    if (this.tagName === "TEXTAREA") {
      return box(TEXTAREA_BOX.top - viewport.scrollTop, TEXTAREA_BOX.left, 0)
    }
    const slot = this.getAttribute?.("data-slot")
    if (slot === "prompt-input") return box(SHELL_BOX.top, SHELL_BOX.left, 0)

    if (slot === "scroll-area-viewport") return box(SHELL_BOX.top, 0, 0)
    return box(0, 0, 0)
  }

  restore = () => {
    Object.defineProperty(
      Element.prototype,
      "getBoundingClientRect",
      descriptor,
    )
  }
}

afterEach(() => {
  restore?.()
  restore = null
  document.body.innerHTML = ""
})

describe("measureCaret", () => {
  it("measures the caret from the host's padding edge, through the textarea's live box", () => {
    const { shell, viewport, textarea } = editor()
    declareBoxes(viewport)

    const rect = measureCaret(textarea, "hello", 5, shell)

    expect(rect?.top).toBe(WITHIN.top + TEXTAREA_BOX.top - SHELL_BOX.top)
    expect(rect?.left).toBe(WITHIN.left + TEXTAREA_BOX.left - SHELL_BOX.left)
  })

  it("follows the caret when the editor's viewport scrolls under it", () => {
    const { shell, viewport, textarea } = editor()
    declareBoxes(viewport)

    viewport.scrollTop = 42
    expect(textarea.scrollTop).toBe(0)

    const rect = measureCaret(textarea, "hello", 5, shell)

    expect(rect?.top).toBe(WITHIN.top + TEXTAREA_BOX.top - 42 - SHELL_BOX.top)
  })

  it("subtracts a clamped textarea's own scroll of its text", () => {
    const { shell, viewport, textarea } = editor()
    declareBoxes(viewport)

    textarea.scrollTop = 7

    const rect = measureCaret(textarea, "hello", 5, shell)

    expect(rect?.top).toBe(WITHIN.top - 7 + TEXTAREA_BOX.top - SHELL_BOX.top)
  })

  it("measures against the textarea itself by default", () => {
    const { viewport, textarea } = editor()
    declareBoxes(viewport)

    const rect = measureCaret(textarea, "hello", 5)

    expect(rect?.top).toBe(WITHIN.top)
  })
})

describe("editorScrollHost", () => {
  it("finds the viewport that scrolls the draft", () => {
    const { viewport, textarea } = editor()
    expect(editorScrollHost(textarea)).toBe(viewport)
  })

  it("is the element itself when there is no scroll area around it", () => {
    const textarea = document.createElement("textarea")
    document.body.appendChild(textarea)
    expect(editorScrollHost(textarea)).toBe(textarea)
  })
})
