import { usePromptInput } from "@workspace/ui/components/prompt-input"
import { useLayoutEffect, useRef, useState } from "react"
import { editorScrollHost } from "../primitives/prompt-input"
import { type ComposerDensity, isOverflowing } from "../state/composer-density"
import { usePromptStore } from "../state/prompt-store"

const CLUSTER_GAP_PX = 8

type Insets = { left: string; right: string }

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

  const report = useRef(onOverflowChange)
  useLayoutEffect(() => {
    report.current = onOverflowChange
  })

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

    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(measure)
    observer.observe(textarea)
    return () => observer.disconnect()
  }, [textareaRef, text, insets])

  useLayoutEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

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
