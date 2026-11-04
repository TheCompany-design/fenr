export type ComposerDensity = "pill" | "panel"

export const DENSITY_OVERFLOW_TOLERANCE_PX = 1

export const PANEL_EDITOR_MAX_HEIGHT_PX = 220

/**
 * The draft's typography, shared verbatim by the textarea and the mention
 * layer rendered behind it. The layer only aligns with the caret because its
 * text lays out exactly where the textarea's would — one class drifting and
 * every pill sits a hair off its `@`.
 */
export const DRAFT_TEXT_CLASSES = "text-base leading-relaxed md:text-base"

/**
 * The draft's box per density. The pill's horizontal insets are CSS vars set
 * on the editor canvas (see `ComposerDensityProbe`) so the textarea and the
 * mention layer both inherit them.
 */
export function draftBoxClasses(density: ComposerDensity): string {
  return density === "pill"
    ? "max-h-[1lh] min-h-0 py-0 pl-[var(--pill-inset-left,0px)] pr-[var(--pill-inset-right,0px)]"
    : "min-h-12 px-3 pt-3 pb-1"
}

export function isOverflowing(input: {
  scrollHeight: number
  clientHeight: number
  tolerance?: number
}): boolean {
  return (
    input.scrollHeight - input.clientHeight >
    (input.tolerance ?? DENSITY_OVERFLOW_TOLERANCE_PX)
  )
}

export function resolveDensity(input: {
  overflowing: boolean
  hasAttachments: boolean
}): ComposerDensity {
  return input.overflowing || input.hasAttachments ? "panel" : "pill"
}
