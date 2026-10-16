import { afterEach, describe, expect, it } from "bun:test"
import { measureCaret } from "./caret"
import { editorScrollHost } from "./prompt-input"

/**
 * Caret measurement, against a DOM that has no layout.
 *
 * happy-dom gives every element a zero-sized box, so the only thing worth
 * testing here is the arithmetic that turns boxes into the popup's position.
 * That arithmetic has to be checked against the geometry a real browser
 * actually produces, not a convenient fiction:
 *
 *   the mirror   is `position: absolute; top: 0` on `document.body`, so it
 *                lays out at the document origin — `left: -9999px` puts it
 *                off-screen, and nothing about the textarea's position on
 *                the page enters its layout;
 *   the marker   therefore reports the caret's offset *within the textarea*,
 *                not the caret's document position;
 *   the textarea and the shell report their real boxes, and scrolling the
 *                editor's viewport moves the textarea's box up within the
 *                shell — the model below declares that too.
 *
 * An earlier version of this file declared the marker where the caret sits in
 * the document. That is a geometry the production mirror cannot produce, and
 * the suite green under it certified an anchor that put the popup hundreds of
 * pixels above the caret in the real browser.
 */

/** Where the caret sits inside the textarea: the marker's offset from the mirror. */
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

/** shell → scroll viewport → textarea, which is the composer's actual shape. */
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

/**
 * Declares the boxes happy-dom cannot lay out. The marker (the only SPAN) is
 * told apart from the mirror (a plain DIV, at the document origin) and from
 * the slotted elements by what the function under test can also see: tags
 * and `data-slot` — it is handed neither, so identity is the only honest key.
 *
 * Scrolling the editor's viewport moves the textarea's box within the shell —
 * that is what the live `getBoundingClientRect` reads in a real browser — so
 * the declared textarea box derives from the viewport's scroll.
 */
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
    // The mirror: `position: absolute; top: 0` on the body — the document
    // origin, which is the whole basis of the within-textarea measurement.
    if (slot === "scroll-area-viewport") return box(SHELL_BOX.top, 0, 0)
    return box(0, 0, 0)
  }

  restore = () => {
    // Restored by descriptor, and this is the part that is easy to get
    // wrong: `Object.defineProperty(proto, key, fn)` does NOT install `fn` —
    // a function has no `value`/`writable`/`get`/`set` own properties, so it
    // reads as an empty descriptor and changes nothing, leaving the stub
    // installed for every test file that runs after this one. The original
    // descriptor is the only faithful thing to put back.
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

    // The caret is 400px into the textarea; the textarea's border box is
    // 100px from the document origin and the shell's 80px, so the caret is
    // 420px from the shell — 400 inside the textarea plus 20 of textarea
    // outside of it. The popup is positioned against that same padding edge.
    expect(rect?.top).toBe(WITHIN.top + TEXTAREA_BOX.top - SHELL_BOX.top)
    expect(rect?.left).toBe(WITHIN.left + TEXTAREA_BOX.left - SHELL_BOX.left)
  })

  it("follows the caret when the editor's viewport scrolls under it", () => {
    const { shell, viewport, textarea } = editor()
    declareBoxes(viewport)

    // The browser scrolls the *viewport* to reveal the caret; that moves the
    // textarea's box up within the shell, which the live rect difference
    // picks up — the textarea's own scrollTop never leaves zero.
    viewport.scrollTop = 42
    expect(textarea.scrollTop).toBe(0)

    const rect = measureCaret(textarea, "hello", 5, shell)

    expect(rect?.top).toBe(WITHIN.top + TEXTAREA_BOX.top - 42 - SHELL_BOX.top)
  })

  it("subtracts a clamped textarea's own scroll of its text", () => {
    const { shell, viewport, textarea } = editor()
    declareBoxes(viewport)

    // In the pill the textarea is clamped to one line and can scroll its
    // text under itself for the moment between a keystroke and the density
    // flip. The mirror cannot scroll, so the shift is subtracted explicitly.
    textarea.scrollTop = 7

    const rect = measureCaret(textarea, "hello", 5, shell)

    expect(rect?.top).toBe(WITHIN.top - 7 + TEXTAREA_BOX.top - SHELL_BOX.top)
  })

  it("measures against the textarea itself by default", () => {
    const { viewport, textarea } = editor()
    declareBoxes(viewport)

    const rect = measureCaret(textarea, "hello", 5)

    // The documented default: the caret's offset from the textarea's own
    // padding edge. The scroll above is *not* corrected for — the editor's
    // scroll only shows up in the offset between two different boxes, and
    // here both boxes are the textarea — which is why the composer passes
    // the shell.
    expect(rect?.top).toBe(WITHIN.top)
  })
})

describe("editorScrollHost", () => {
  it("finds the viewport that scrolls the draft", () => {
    const { viewport, textarea } = editor()
    expect(editorScrollHost(textarea)).toBe(viewport)
  })

  it("is the element itself when there is no scroll area around it", () => {
    // The pill's own measurement clamps the textarea, so a textarea can exist
    // without the scroll area in tests and in any caller that mounts the shell
    // without the composer.
    const textarea = document.createElement("textarea")
    document.body.appendChild(textarea)
    expect(editorScrollHost(textarea)).toBe(textarea)
  })
})
