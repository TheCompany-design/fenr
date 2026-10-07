"use client"

/**
 * Gliding pill for dropdown rows.
 *
 * Every dropdown moves one pill between its rows instead of cross-fading
 * each row's own hover background: the pill is keyed by a per-dropdown
 * `layoutId`, so rows inside one dropdown glide into each other while rows
 * in different dropdowns never animate across menus.
 *
 * Rows must opt in on both hover and keyboard focus — a pointer-only pill
 * leaves arrow-key navigation with no visible position.
 *
 * ```tsx
 * const glide = useDropdownGlider()
 * // ...
 * <button {...glide.rowProps("billing")}>
 *   <DropdownGlidePill layoutId={glide.layoutId} active={glide.activeId === "billing"} />
 *   Billing
 * </button>
 * ```
 */
import { SPRING_LAYOUT } from "@workspace/ui/lib/ease"
import { cn } from "@workspace/ui/lib/utils"
import { m, useReducedMotion } from "motion/react"
import { useId, useState } from "react"

/** Row handlers that hand the pill to whichever row the pointer or focus is on. */
export interface DropdownRowProps {
  onFocus: () => void
  onPointerMove: (event: React.PointerEvent<HTMLElement>) => void
}

export interface DropdownGlider {
  /** Id of the row currently holding the pill. */
  activeId: string | null
  /** The `layoutId` shared by every row of this dropdown. */
  layoutId: string
  /** Spread onto a row: `...glide.rowProps(id)`. */
  rowProps: (id: string) => DropdownRowProps
}

export function useDropdownGlider(): DropdownGlider {
  const [activeId, setActiveId] = useState<string | null>(null)
  const id = useId()

  return {
    activeId,
    layoutId: `${id}-dropdown-glider`,
    rowProps: (rowId: string) => ({
      onFocus: () => setActiveId(rowId),
      onPointerMove: (event) => {
        // Touch has no hover state to follow — claiming the pill on a tap
        // leaves it stuck on the row the user is leaving.
        if (event.pointerType !== "touch") {
          setActiveId(rowId)
        }
      },
    }),
  }
}

export interface DropdownGlidePillProps {
  /** Whether this row is the one holding the pill. */
  active: boolean
  /** The dropdown's shared `layoutId`, from `useDropdownGlider`. */
  layoutId: string
  className?: string
}

export function DropdownGlidePill({
  active,
  layoutId,
  className,
}: DropdownGlidePillProps) {
  const reduce = useReducedMotion() ?? false

  if (!active) return null

  return (
    <m.span
      layoutId={layoutId}
      data-glide-pill=""
      transition={reduce ? { duration: 0 } : SPRING_LAYOUT}
      className={cn(
        "pointer-events-none absolute inset-0 -z-10 rounded-lg bg-accent",
        className,
      )}
    />
  )
}
