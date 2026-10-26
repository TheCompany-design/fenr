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
