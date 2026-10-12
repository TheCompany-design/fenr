/**
 * Motion tokens for the composer's layout animations.
 *
 * Declared locally rather than imported from the app's `lib/motion` for the
 * same reason as everything else in this folder: a copied folder that reaches
 * back into the host app's design tokens is not portable.
 *
 * `layout` is what does the work. The context rail and the blocker rows appear
 * and disappear as attachments and blockers change, and animating `height`
 * from a measured pixel value is what keeps the composer from jumping — a
 * fade alone leaves a hole, and a hard cut moves every element below it.
 */
export const TRANSITION_LAYOUT = {
  type: "spring",
  stiffness: 420,
  damping: 38,
  mass: 0.8,
} as const

/** Content that enters with no size change to animate. */
export const TRANSITION_FADE = {
  duration: 0.18,
  ease: [0.22, 1, 0.36, 1],
} as const
