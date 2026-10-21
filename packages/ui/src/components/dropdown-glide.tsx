"use client"

import { SPRING_LAYOUT } from "@workspace/ui/lib/ease"
import { cn } from "@workspace/ui/lib/utils"
import { m, useReducedMotion } from "motion/react"
import { useId, useState } from "react"

export interface DropdownRowProps {
  onFocus: () => void
  onPointerMove: (event: React.PointerEvent<HTMLElement>) => void
}

export interface DropdownGlider {
  activeId: string | null

  layoutId: string

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
