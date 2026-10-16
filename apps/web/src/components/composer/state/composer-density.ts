/**
 * How much room the composer takes, derived from what is actually in it.
 *
 * The composer has two densities — a single-row `pill` and the multi-row
 * `panel` — and it is one component in both, not two designs that look alike.
 * What makes that possible is that the density is never *set*: it is a
 * consequence, so the same box with the same textarea, the same autocomplete,
 * and the same controls can be measured at two heights without either being a
 * special case.
 *
 * Only two inputs earn the right to decide, and the discipline of keeping it to
 * two is the point:
 *
 *   overflowing     — the draft no longer fits one line. This is the morph:
 *                     a message that needs two lines is given two lines.
 *   hasAttachments  — staged files are drawn as a rail of chips, which is a
 *                     row of its own. Rather than hide the chips, the box
 *                     grows to hold them.
 *
 * Anything else a menu, a send in flight, or a failed provider load might do
 * has no business resizing the box: it would make the height depend on state
 * the user cannot see, and the box would move for reasons unrelated to what
 * they are writing.
 */

export type ComposerDensity = "pill" | "panel"

/**
 * A text box's `scrollHeight` can land a fraction of a pixel past its
 * `clientHeight` for content that genuinely fits — sub-pixel line boxes and a
 * trailing newline both do it — so the comparison needs a little slack. One
 * pixel is below the smallest line box in use and far below the second line we
 * are actually testing for.
 */
export const DENSITY_OVERFLOW_TOLERANCE_PX = 1

/**
 * Where the panel's draft stops growing.
 *
 * Roughly eight lines. Past that the draft stops being a thing you read at a
 * glance and becomes a document, and the conversation above it — which is the
 * context the draft is written *into* — starts losing the screen to a box the
 * user is only scrolling past. The overflow is the app's `ScrollArea`, not the
 * browser's, so a long draft scrolls with the thumb the rest of the app uses.
 *
 * The pill's cap is not a number: it is one line, and it lives on the textarea
 * (`max-h-[1lh]`) because the pill has to *measure* against that exact height
 * rather than approximate it.
 */
export const PANEL_EDITOR_MAX_HEIGHT_PX = 220

/**
 * Whether a clamped textarea has content below the fold.
 *
 * Takes the two measured numbers rather than the element so the rule is
 * testable without a DOM, and so the caller owns every browser detail.
 */
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
