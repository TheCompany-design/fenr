"use client"

import { EASE_OUT } from "@workspace/ui/lib/ease"
import { cn } from "@workspace/ui/lib/utils"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import {
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"
import { createPortal } from "react-dom"

export const VIEWPORT_PADDING = 8
export const MORPH_DURATION = 0.28

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function collapsedClip(
  origin: { x: number; y: number },
  size: { width: number; height: number },
): string {
  const half = 8
  const top = clamp(origin.y - half, 0, size.height)
  const right = clamp(size.width - origin.x - half, 0, size.width)
  const bottom = clamp(size.height - origin.y - half, 0, size.height)
  const left = clamp(origin.x - half, 0, size.width)
  return `inset(${top}px ${right}px ${bottom}px ${left}px round 12px)`
}

const emptySubscribe = () => () => {}
export function useIsMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  )
}

export interface AnimatedDropdownProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  trigger: ReactElement
  triggerRef?: RefObject<HTMLElement | null>
  side?: "top" | "bottom" | "right" | "left"
  align?: "start" | "center" | "end"
  sideOffset?: number
  className?: string
  children: (onClose: () => void) => ReactNode
}

/**
 * High-performance animated dropdown container leveraging origin-based clip-path morph mechanics.
 * Supports button trigger origin calculation, auto-flip, keyboard navigation, outside-click, and viewport constraints.
 */
export function AnimatedDropdown({
  open,
  onOpenChange,
  trigger,
  triggerRef,
  side = "top",
  align = "start",
  sideOffset = 8,
  className,
  children,
}: AnimatedDropdownProps) {
  const mounted = useIsMounted()
  const internalTriggerRef = useRef<HTMLElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const [position, setPosition] = useState<{ left: number; top: number }>({
    left: 0,
    top: 0,
  })
  const [origin, setOrigin] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [size, setSize] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  })
  const [morphReady, setMorphReady] = useState(false)
  const reduce = useReducedMotion() ?? false

  const updatePosition = useCallback(() => {
    const triggerEl = triggerRef?.current ?? internalTriggerRef.current
    if (!triggerEl || !contentRef.current) return
    const triggerRect = triggerEl.getBoundingClientRect()
    const contentRect = contentRef.current.getBoundingClientRect()

    let effectiveSide = side
    if (
      side === "bottom" &&
      triggerRect.bottom + sideOffset + contentRect.height >
        window.innerHeight - VIEWPORT_PADDING &&
      triggerRect.top - contentRect.height - sideOffset >= VIEWPORT_PADDING
    ) {
      effectiveSide = "top"
    } else if (
      side === "top" &&
      triggerRect.top - contentRect.height - sideOffset < VIEWPORT_PADDING &&
      triggerRect.bottom + sideOffset + contentRect.height <=
        window.innerHeight - VIEWPORT_PADDING
    ) {
      effectiveSide = "bottom"
    }

    let left = triggerRect.left
    let top = triggerRect.top

    if (effectiveSide === "top") {
      top = triggerRect.top - contentRect.height - sideOffset
      if (align === "start") left = triggerRect.left
      else if (align === "end") left = triggerRect.right - contentRect.width
      else left = triggerRect.left + (triggerRect.width - contentRect.width) / 2
    } else if (effectiveSide === "bottom") {
      top = triggerRect.bottom + sideOffset
      if (align === "start") left = triggerRect.left
      else if (align === "end") left = triggerRect.right - contentRect.width
      else left = triggerRect.left + (triggerRect.width - contentRect.width) / 2
    } else if (effectiveSide === "right") {
      left = triggerRect.right + sideOffset
      if (align === "center") {
        top = triggerRect.top + (triggerRect.height - contentRect.height) / 2
      } else if (align === "end") {
        top = triggerRect.bottom - contentRect.height
      } else {
        top = triggerRect.top
      }
    } else if (effectiveSide === "left") {
      left = triggerRect.left - contentRect.width - sideOffset
      if (align === "center") {
        top = triggerRect.top + (triggerRect.height - contentRect.height) / 2
      } else {
        top = triggerRect.top
      }
    }

    // Viewport bounds clamping
    const clampedLeft = Math.max(
      VIEWPORT_PADDING,
      Math.min(window.innerWidth - contentRect.width - VIEWPORT_PADDING, left),
    )
    const clampedTop = Math.max(
      VIEWPORT_PADDING,
      Math.min(window.innerHeight - contentRect.height - VIEWPORT_PADDING, top),
    )

    setPosition({ left: clampedLeft, top: clampedTop })
    setSize({ width: contentRect.width, height: contentRect.height })

    // Origin inside content relative to trigger center
    const triggerCenter = {
      x: triggerRect.left + triggerRect.width / 2,
      y: triggerRect.top + triggerRect.height / 2,
    }

    setOrigin({
      x: clamp(
        triggerCenter.x - clampedLeft,
        12,
        Math.max(12, contentRect.width - 12),
      ),
      y: clamp(
        triggerCenter.y - clampedTop,
        12,
        Math.max(12, contentRect.height - 12),
      ),
    })
  }, [side, align, sideOffset, triggerRef])

  useLayoutEffect(() => {
    if (!open) {
      setMorphReady(false)
      return
    }

    updatePosition()
    setMorphReady(false)

    if (reduce) {
      setMorphReady(true)
      return
    }

    let openFrame = 0
    const prepareFrame = requestAnimationFrame(() => {
      updatePosition()
      openFrame = requestAnimationFrame(() => setMorphReady(true))
    })

    return () => {
      cancelAnimationFrame(prepareFrame)
      cancelAnimationFrame(openFrame)
    }
  }, [open, updatePosition, reduce])

  // Outside click & window change listeners
  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (!target) return
      const triggerEl = triggerRef?.current ?? internalTriggerRef.current
      if (contentRef.current?.contains(target) || triggerEl?.contains(target)) {
        return
      }
      onOpenChange(false)
    }

    const onWindowChange = () => {
      onOpenChange(false)
    }

    window.addEventListener("pointerdown", onPointerDown)
    window.addEventListener("resize", onWindowChange)
    window.addEventListener("scroll", onWindowChange, {
      passive: true,
      capture: true,
    })

    return () => {
      window.removeEventListener("pointerdown", onPointerDown)
      window.removeEventListener("resize", onWindowChange)
      window.removeEventListener("scroll", onWindowChange, {
        capture: true,
      })
    }
  }, [open, onOpenChange, triggerRef])

  // Keyboard navigation
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault()
      onOpenChange(false)
      const triggerEl = triggerRef?.current ?? internalTriggerRef.current
      triggerEl?.focus()
      return
    }

    const items = contentRef.current
      ? Array.from(
          contentRef.current.querySelectorAll<HTMLElement>(
            '[data-menu-item="true"]:not([disabled])',
          ),
        )
      : []

    if (items.length === 0) return

    const currentIndex = items.indexOf(document.activeElement as HTMLElement)

    if (event.key === "ArrowDown") {
      event.preventDefault()
      const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % items.length
      items[nextIndex]?.focus()
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      const prevIndex =
        currentIndex < 0
          ? items.length - 1
          : (currentIndex - 1 + items.length) % items.length
      items[prevIndex]?.focus()
    } else if (event.key === "Home") {
      event.preventDefault()
      items[0]?.focus()
    } else if (event.key === "End") {
      event.preventDefault()
      items[items.length - 1]?.focus()
    }
  }

  const triggerNode = isValidElement(trigger)
    ? cloneElement(trigger as ReactElement<Record<string, unknown>>, {
        ref: (node: HTMLElement | null) => {
          internalTriggerRef.current = node
          const origRef = (
            trigger as unknown as { ref?: (n: HTMLElement | null) => void }
          ).ref
          if (typeof origRef === "function") {
            origRef(node)
          }
        },
        onClick: (e: React.MouseEvent<HTMLElement>) => {
          const origOnClick = (
            trigger.props as {
              onClick?: (e: React.MouseEvent<HTMLElement>) => void
            }
          ).onClick
          origOnClick?.(e)
          if (!e.defaultPrevented) {
            onOpenChange(!open)
          }
        },
        "aria-haspopup": "menu",
        "aria-expanded": open,
      })
    : trigger

  const clipHidden = collapsedClip(origin, size)
  const clipShown = "inset(0px 0px 0px 0px round 16px)"
  const visualOpen = open && morphReady

  if (!mounted) {
    return triggerNode
  }

  return (
    <>
      {triggerNode}
      {createPortal(
        <AnimatePresence>
          {open && (
            <div
              data-animated-dropdown-portal=""
              aria-hidden={!open}
              style={{
                position: "fixed",
                left: position.left,
                top: position.top,
                zIndex: 100,
              }}
              className={cn(
                "pointer-events-auto [filter:drop-shadow(0_18px_28px_rgba(0,0,0,0.22))]",
              )}
            >
              <motion.div
                ref={contentRef}
                tabIndex={-1}
                onKeyDown={handleKeyDown}
                initial={
                  reduce
                    ? { opacity: 0 }
                    : {
                        opacity: 0,
                        clipPath: clipHidden,
                      }
                }
                animate={{
                  opacity: visualOpen ? 1 : 0,
                  clipPath: reduce || visualOpen ? clipShown : clipHidden,
                }}
                exit={
                  reduce
                    ? { opacity: 0 }
                    : {
                        opacity: 0,
                        clipPath: clipHidden,
                        transition: { duration: 0.16, ease: EASE_OUT },
                      }
                }
                transition={
                  reduce
                    ? { duration: 0.1, ease: EASE_OUT }
                    : {
                        clipPath: {
                          duration: MORPH_DURATION,
                          ease: EASE_OUT,
                        },
                        opacity: {
                          duration: MORPH_DURATION,
                          ease: EASE_OUT,
                        },
                      }
                }
                className={cn(
                  "w-72 overflow-hidden rounded-2xl border border-border/80 bg-popover/95 p-1.5 shadow-2xl backdrop-blur-md outline-none",
                  className,
                )}
              >
                {children(() => onOpenChange(false))}
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
}
