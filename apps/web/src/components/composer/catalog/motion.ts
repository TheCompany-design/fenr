export const TRANSITION_LAYOUT = {
  type: "spring",
  stiffness: 420,
  damping: 38,
  mass: 0.8,
} as const

export const TRANSITION_FADE = {
  duration: 0.18,
  ease: [0.22, 1, 0.36, 1],
} as const
