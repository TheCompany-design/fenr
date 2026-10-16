/**
 * Caret position inside a `<textarea>`.
 *
 * A textarea renders its own text and exposes nothing about where a given
 * offset landed on screen. There is no cross-browser equivalent of
 * `caretPositionFromPoint`, and the one that exists returns pixel offsets for
 * a *point*, not for an index, which requires bisecting against a hit test.
 *
 * The mirror technique is the reliable answer: clone the textarea's computed
 * text styles onto an off-screen element, lay out the same text up to the
 * caret, wrap the caret character in a span, and read the span's box. The
 * browser then does the line-breaking and bidi reordering for us, exactly as
 * it would in the textarea.
 *
 * Two details that are easy to miss and produce a popup that is off by one
 * line or drifts on every scroll:
 *
 *  - the mirror must be `position: absolute` and *visible* to the layout
 *    engine (`visibility: hidden` is fine, `display: none` is not — it would
 *    collapse every rect to zero)
 *  - the measured rect has to be corrected for scrolling that happens
 *    *inside* the textarea (`scrollTop`), or the popup stays put while the
 *    text moves under it
 */

const COPIED_PROPERTIES = [
  "boxSizing",
  "width",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "fontStyle",
  "fontVariant",
  "fontWeight",
  "fontSize",
  "fontSizeAdjust",
  "lineHeight",
  "fontFamily",
  "letterSpacing",
  "wordSpacing",
  "textTransform",
  "textIndent",
  "textAlign",
  "whiteSpace",
  "wordBreak",
  "overflowWrap",
  "tabSize",
  "direction",
] as const

export type CaretRect = {
  top: number
  left: number
  height: number
}

/**
 * The caret's offset inside the textarea, in the mirror's own frame.
 *
 * The mirror is laid out at the document origin (see `position: absolute;
 * top: 0` below), so the marker's box says where the caret sits *within the
 * textarea* and nothing about where the textarea itself is. That is the point:
 * the difference of two boxes in the same frame cancels the page's scroll out
 * of the measurement entirely.
 *
 * The textarea's own `scrollTop` is subtracted because a clamped textarea
 * scrolls its text under itself — in the pill, for the moment between a
 * keystroke and the density probe's flip — and the mirror, which cannot
 * scroll, does not model that shift.
 */
function caretWithinTextarea(
  markerBox: DOMRect,
  mirrorBox: DOMRect,
  textarea: HTMLTextAreaElement,
): CaretRect {
  return {
    top: markerBox.top - mirrorBox.top - textarea.scrollTop,
    left: markerBox.left - mirrorBox.left - textarea.scrollLeft,
    height: markerBox.height,
  }
}

export function measureCaret(
  textarea: HTMLTextAreaElement,
  value: string,
  caret: number,
  /**
   * The box the popup is positioned in — in practice the input shell, whose
   * `relative` class makes it the popup's containing block. The returned rect
   * is the caret's offset from this box's *padding edge*, ready to be used as
   * the popup's CSS `top`/`left`. Defaults to the textarea itself.
   */
  relativeTo: HTMLElement = textarea,
): CaretRect | null {
  if (typeof document === "undefined") return null

  const computed = getComputedStyle(textarea)
  const mirror = document.createElement("div")

  const style = mirror.style
  style.position = "absolute"
  style.top = "0"
  style.left = "-9999px"
  style.visibility = "hidden"
  style.overflow = "hidden"
  style.whiteSpace = "pre-wrap"
  style.wordWrap = "break-word"

  for (const property of COPIED_PROPERTIES) {
    const cssValue = computed.getPropertyValue(
      property.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`),
    )
    if (cssValue) style.setProperty(property, cssValue)
  }
  // A mirror cannot scroll; capping it at the textarea's height keeps the
  // element from growing the document while it is attached.
  style.height = `${textarea.clientHeight}px`
  style.overflowY = "hidden"

  mirror.textContent = value.slice(0, caret)

  const marker = document.createElement("span")
  // A zero-width marker measures nothing, so a space stands in when the caret
  // sits at the very end of the value.
  marker.textContent = value.slice(caret, caret + 1) || " "
  mirror.appendChild(marker)

  document.body.appendChild(mirror)

  let rect: CaretRect | null = null
  try {
    // Two frames, each self-cancelling for page scroll:
    //
    //   the caret inside the textarea  — marker minus mirror, both laid out at
    //                                   the document origin (this function)
    //   the textarea inside the host   — a live rect difference, which carries
    //                                   the editor's scroll for free: scrolling
    //                                   the viewport between the two moves the
    //                                   textarea's box within the shell, so the
    //                                   anchor follows the caret without a
    //                                   separate scroll term to forget
    //
    // Summed, they are the caret's offset from the host's padding edge — which
    // is exactly what an absolutely positioned popup wants as its CSS `top`
    // and `left`, since it is placed against that same padding box. An
    // absolutely positioned child is placed against the containing block's
    // *padding* box, so the host's border comes off before the offset is
    // applied (`clientTop`/`clientLeft`).
    const within = caretWithinTextarea(
      marker.getBoundingClientRect(),
      mirror.getBoundingClientRect(),
      textarea,
    )
    const textareaBox = textarea.getBoundingClientRect()
    const hostBox = relativeTo.getBoundingClientRect()

    rect = {
      top: within.top + textareaBox.top - hostBox.top - relativeTo.clientTop,
      left:
        within.left + textareaBox.left - hostBox.left - relativeTo.clientLeft,
      height: within.height || parseFloat(computed.lineHeight) || 20,
    }
  } finally {
    mirror.remove()
  }

  return rect
}
