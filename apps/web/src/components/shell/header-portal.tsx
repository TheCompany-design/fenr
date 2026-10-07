import { cn } from "@workspace/ui/lib/utils"
import { type ReactNode, useCallback } from "react"
import { createPortal } from "react-dom"
import {
  type HeaderPortalRegion,
  useHeaderPortalStore,
} from "@/lib/stores/header-portal.store"

export interface HeaderPortalSlotProps {
  /** Which slot of the header this is. */
  readonly region: HeaderPortalRegion
  /** Layout and styling for the slot itself. */
  readonly className?: string
}

/**
 * One slot of the app header: an empty container that publishes its own node so
 * any descendant can render content into exactly this spot.
 *
 * A *region* is which part of the bar (`start`, `center`, `end`); a *slot* is the
 * container the shell renders for one of them.
 *
 * The shell owns one of these per region and never renders feature content
 * itself — that separation is the whole point. The container is always rendered
 * (never conditionally) so the header's layout does not shift as pages come and
 * go.
 */
export function HeaderPortalSlot({ region, className }: HeaderPortalSlotProps) {
  const publish = useHeaderPortalStore((state) => state.publish)
  const ref = useCallback(
    (element: HTMLDivElement | null) => {
      publish(region, element)
    },
    [publish, region],
  )

  return (
    <div
      className={className}
      data-slot={`header-portal-${region}`}
      ref={ref}
    />
  )
}

/**
 * The node a region renders into, or `null` when that region is not mounted —
 * on the server, and during the first client render before the shell's refs
 * attach.
 */
export function useHeaderPortalTarget(
  region: HeaderPortalRegion,
): HTMLElement | null {
  return useHeaderPortalStore((state) => state.targets[region])
}

export interface HeaderPortalProps {
  readonly region: HeaderPortalRegion
  /** Layout and styling for this contributor's own wrapper element. */
  readonly className?: string
  readonly children: ReactNode
}

/**
 * Renders its children into a slot of the app shell's header.
 *
 * Content is ordinary React, so it keeps working across the portal boundary —
 * TanStack Query, the router and every other provider above still reach it — and
 * a page may inject anything: text, an icon, a button, a whole component. It
 * lives in the header's DOM, but in the page's React tree, so its state and
 * hooks behave exactly as they would in place.
 *
 * Layout and styling are the caller's: `className` lands on a wrapper element
 * that is a flex item of the region, so an injector can truncate, pad, or
 * right-align itself without reaching into the shell. `min-w-0` is always on
 * that wrapper because it is a flex item, and a flex item without it refuses to
 * shrink below its content — which is how one long title ends up shoving the
 * account menu off the bar.
 *
 * Nothing is rendered until the target exists, so injected content never
 * appears twice (once in place, once in the header) during hydration.
 */
export function HeaderPortal({
  children,
  className,
  region,
}: HeaderPortalProps) {
  const target = useHeaderPortalTarget(region)

  if (target === null) {
    return null
  }

  return createPortal(
    <div className={cn("min-w-0", className)} data-slot="header-portal-content">
      {children}
    </div>,
    target,
  )
}
