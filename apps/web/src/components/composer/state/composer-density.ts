export type ComposerDensity = "pill" | "panel"

export const DENSITY_OVERFLOW_TOLERANCE_PX = 1

export const PANEL_EDITOR_MAX_HEIGHT_PX = 220

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
