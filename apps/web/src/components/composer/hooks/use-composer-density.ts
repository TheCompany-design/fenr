import { usePromptInput } from "@workspace/ui/components/prompt-input"
import { useLayoutEffect, useRef, useState } from "react"
import { editorScrollHost } from "../primitives/prompt-input"
import { type ComposerDensity, isOverflowing } from "../state/composer-density"
import { usePromptStore } from "../state/prompt-store"

/**
 * The clearance between the draft's text and the controls it sits between.
 *
 * The pill puts its controls on the same row the text is written into, so the
 * text needs room at both ends or the model picker lands on top of it. None of
 * that room is knowable ahead of time — the trail is as wide as the model name
 * it happens to be showing, and the lead widens when a tool is switched on — so
 * both are measured rather than guessed at.
 */
const CLUSTER_GAP_PX = 8

type Insets = { left: string; right: string }

/**
 * Whether the draft still fits the pill — measured *at pill geometry*, always.
 *
 * This is the subtle part of the morph. The obvious reading of "has the text
 * outgrown one line" is to compare the textarea's own scroll height against its
 * own client height, but those numbers mean different things in each density:
 * in the pill the box is clamped to one line and scrolls, in the panel it grows
 * with its own padding. Measuring only in the pill means a draft is never
 * re-examined once it has expanded; measuring in the panel means re-examining it
 * at the *wider* panel width, so a draft sitting on the wrap boundary expands,
 * fits on one line there, collapses, wraps again — and the box oscillates on
 * every keystroke. Worse, the panel's padding counts toward `scrollHeight`, so
 * a comfortable one-line draft would read as two lines and never collapse at
 * all.
 *
 * So the clamp and the gutters are applied for the measurement itself and then
 * taken back off. The box is momentarily the pill's shape, the answer means
 * "would this fit in the pill", and that answer does not depend on which
 * density we are in — which is what makes the morph settle instead of flicker.
 */
export function measurePillOverflow(
  textarea: HTMLTextAreaElement,
  insets: Insets,
): boolean {
  const previous = {
    maxHeight: textarea.style.maxHeight,
    paddingTop: textarea.style.paddingTop,
    paddingBottom: textarea.style.paddingBottom,
    paddingLeft: textarea.style.paddingLeft,
    paddingRight: textarea.style.paddingRight,
  }

  textarea.style.maxHeight = "1lh"
  textarea.style.paddingTop = "0px"
  textarea.style.paddingBottom = "0px"
  textarea.style.paddingLeft = insets.left
  textarea.style.paddingRight = insets.right

  try {
    return isOverflowing({
      scrollHeight: textarea.scrollHeight,
      clientHeight: textarea.clientHeight,
    })
  } finally {
    textarea.style.maxHeight = previous.maxHeight
    textarea.style.paddingTop = previous.paddingTop
    textarea.style.paddingBottom = previous.paddingBottom
    textarea.style.paddingLeft = previous.paddingLeft
    textarea.style.paddingRight = previous.paddingRight
  }
}

/**
 * Reports whether the draft has outgrown the pill. Renders nothing.
 *
 * It lives inside the input shell because that is where the textarea's ref
 * lives, and nothing outside the shell can reach the element without threading a
 * ref through the editor for no other reason.
 *
 * Two things can change the answer, and only two: the draft, and the width it
 * wraps into. The draft is watched through the store because in the pill the box
 * height is clamped — typing past one line grows no element, so an observer on
 * the element alone would never notice the text going past its single line.
 */
export function ComposerDensityProbe({
  density,
  onOverflowChange,
}: {
  density: ComposerDensity
  onOverflowChange: (overflowing: boolean) => void
}) {
  const { textareaRef } = usePromptInput()
  const text = usePromptStore((s) => s.text)
  const [insets, setInsets] = useState<Insets>({
    left: "0px",
    right: "0px",
  })

  // Reported by reference rather than by call, so a caller passing an inline
  // arrow cannot tear down and rebuild the observer on every render.
  const report = useRef(onOverflowChange)
  useLayoutEffect(() => {
    report.current = onOverflowChange
  })

  // Published as custom properties rather than applied as padding, so the
  // pill's gutters stay in the stylesheet with every other gutter and the one
  // place the measurement and the layout both read is `insets`.
  useLayoutEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.setProperty("--pill-inset-left", insets.left)
    textarea.style.setProperty("--pill-inset-right", insets.right)
  }, [insets, textareaRef])

  // biome-ignore lint/correctness/useExhaustiveDependencies: `text` is the signal this effect waits on, not an input it reads. In the pill the box is clamped to one line, so nothing about the element changes as the draft passes that line — only a re-run of this measurement can notice. Dropping the dependency leaves a pill that never grows.
  useLayoutEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    const measure = () => {
      report.current(measurePillOverflow(textarea, insets))
    }
    measure()

    // A width change re-wraps the draft, and in the pill nothing else notices:
    // the box height is clamped, so the element the observer watches never
    // changes size as the text passes its single line.
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(measure)
    observer.observe(textarea)
    return () => observer.disconnect()
  }, [textareaRef, text, insets])

  useLayoutEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    // The clusters are structural rather than conditional, so they are found
    // once. With neither present there are no controls to sit against and
    // nothing to clear.
    const shell = textarea.closest('[data-slot="prompt-input"]')
    const lead = shell?.querySelector<HTMLElement>('[data-slot="prompt-lead"]')
    const trail = shell?.querySelector<HTMLElement>(
      '[data-slot="prompt-trail"]',
    )
    if (!lead && !trail) return

    const measureClusters = () => {
      const next: Insets = {
        left: lead
          ? `${Math.ceil(lead.offsetWidth) + CLUSTER_GAP_PX}px`
          : "0px",
        right: trail
          ? `${Math.ceil(trail.offsetWidth) + CLUSTER_GAP_PX}px`
          : "0px",
      }
      setInsets((current) =>
        current.left === next.left && current.right === next.right
          ? current
          : next,
      )
    }
    measureClusters()

    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(measureClusters)
    if (lead) observer.observe(lead)
    if (trail) observer.observe(trail)
    return () => observer.disconnect()
  }, [textareaRef])

  // A box that has just become a pill is a box that was scrolled to its middle
  // a moment ago; without this it opens on empty space or mid-word. The
  // scroll position lives on the viewport around the textarea, not on the
  // textarea, so it is that element which has to be rewound.
  useLayoutEffect(() => {
    if (density !== "pill") return
    const textarea = textareaRef.current
    if (textarea) editorScrollHost(textarea).scrollTop = 0
  }, [density, textareaRef])

  return null
}
