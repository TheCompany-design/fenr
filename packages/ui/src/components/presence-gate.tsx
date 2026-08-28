import { useIsPresent } from "motion/react"
import type { ReactNode } from "react"

export interface PresenceGateRenderProps {
  /**
   * False from the render that starts the exit animation onward. An overlay
   * kept in the tree by `AnimatePresence` is still the topmost thing on the
   * page, so anything it decides from `open` alone stays true for the whole
   * exit — this is the boolean that already knows the overlay is leaving.
   */
  isPresent: boolean
  /**
   * Spread onto every layer that takes pointer events while the overlay is
   * open. Interaction releases in the same commit that starts the exit while
   * the visual exit keeps playing: pointer events stop landing, and `inert`
   * drops the subtree from focus order, from tab order and from the
   * accessibility tree.
   */
  gate: {
    inert: boolean
    style: { pointerEvents: "auto" | "none" }
  }
}

export interface PresenceGateProps {
  children: (props: PresenceGateRenderProps) => ReactNode
}

/**
 * Reads the presence of the subtree it renders and hands it down.
 * `useIsPresent` only answers inside the `AnimatePresence` subtree.
 */
export function PresenceGate({ children }: PresenceGateProps) {
  const isPresent = useIsPresent()

  return children({
    isPresent,
    gate: {
      inert: !isPresent,
      style: { pointerEvents: isPresent ? "auto" : "none" },
    },
  })
}
