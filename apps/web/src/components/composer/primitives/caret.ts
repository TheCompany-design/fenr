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
 *  - the measured rect has to be corrected by the textarea's own scroll, or
 *    the popup stays put while the text moves under it
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

export function measureCaret(
  textarea: HTMLTextAreaElement,
  value: string,
  caret: number,
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
    const markerBox = marker.getBoundingClientRect()
    const hostBox = textarea.getBoundingClientRect()

    rect = {
      top:
        markerBox.top - hostBox.top - textarea.scrollTop + textarea.clientTop,
      left:
        markerBox.left -
        hostBox.left -
        textarea.scrollLeft +
        textarea.clientLeft,
      height: markerBox.height || parseFloat(computed.lineHeight) || 20,
    }
  } finally {
    mirror.remove()
  }

  return rect
}
