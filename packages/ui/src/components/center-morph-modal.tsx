"use client"

import { Cancel01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { PresenceGate } from "@workspace/ui/components/presence-gate"
import { EASE_OUT } from "@workspace/ui/lib/ease"
import { cn } from "@workspace/ui/lib/utils"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import {
  cloneElement,
  createContext,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react"
import { createPortal } from "react-dom"

interface CenterMorphModalContextValue {
  open: boolean
  setOpen: (open: boolean) => void
  triggerId: string
  contentId: string
}

const CenterMorphModalContext =
  createContext<CenterMorphModalContextValue | null>(null)

function useCenterMorphModalContext(component: string) {
  const context = useContext(CenterMorphModalContext)
  if (!context) {
    throw new Error(`${component} must be used within <CenterMorphModal>`)
  }
  return context
}

export interface CenterMorphModalProps {
  children: ReactNode
  /** Controlled open state. */
  open?: boolean
  /** Initial state when used uncontrolled. */
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
}

/**
 * A modal whose full-size surface unfolds outward from its exact center.
 * Supports controlled and uncontrolled state through composable primitives.
 */
export function CenterMorphModal({
  children,
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
}: CenterMorphModalProps) {
  const id = useId()
  const [internalOpen, setInternalOpen] = useState(defaultOpen)
  const controlled = controlledOpen !== undefined
  const open = controlled ? controlledOpen : internalOpen

  const setOpen = useCallback(
    (next: boolean) => {
      if (!controlled) setInternalOpen(next)
      onOpenChange?.(next)
    },
    [controlled, onOpenChange],
  )

  const value = useMemo<CenterMorphModalContextValue>(
    () => ({
      open,
      setOpen,
      triggerId: `${id}-trigger`,
      contentId: `${id}-content`,
    }),
    [id, open, setOpen],
  )

  return (
    <CenterMorphModalContext.Provider value={value}>
      {children}
    </CenterMorphModalContext.Provider>
  )
}

export interface CenterMorphModalTriggerProps {
  children: ReactElement
}

/** Wraps one interactive element and opens or closes the modal. */
export function CenterMorphModalTrigger({
  children,
}: CenterMorphModalTriggerProps) {
  const context = useCenterMorphModalContext("CenterMorphModalTrigger")
  if (!isValidElement(children)) return children

  const child = children as ReactElement<Record<string, unknown>>
  const childOnClick = child.props.onClick as
    | ((event: React.MouseEvent<HTMLElement>) => void)
    | undefined

  return cloneElement(child, {
    id: context.triggerId,
    onClick: (event: React.MouseEvent<HTMLElement>) => {
      childOnClick?.(event)
      if (!event.defaultPrevented) context.setOpen(!context.open)
    },
    "aria-haspopup": "dialog",
    "aria-expanded": context.open,
    "aria-controls": context.open ? context.contentId : undefined,
  })
}

export interface CenterMorphModalCloseProps {
  children: ReactElement
}

/** Wraps one interactive element and closes the modal. */
export function CenterMorphModalClose({
  children,
}: CenterMorphModalCloseProps) {
  const context = useCenterMorphModalContext("CenterMorphModalClose")
  if (!isValidElement(children)) return children

  const child = children as ReactElement<Record<string, unknown>>
  const childOnClick = child.props.onClick as
    | ((event: React.MouseEvent<HTMLElement>) => void)
    | undefined

  return cloneElement(child, {
    onClick: (event: React.MouseEvent<HTMLElement>) => {
      childOnClick?.(event)
      if (!event.defaultPrevented) context.setOpen(false)
    },
  })
}

export interface CenterMorphModalContentProps {
  children: ReactNode
  /** Accessible name announced by screen readers. */
  ariaLabel?: string
  /** Optional id of descriptive content inside the modal. */
  ariaDescribedBy?: string
  /** Close on Escape or backdrop press. Default true. */
  dismissible?: boolean
  /** Render the close control inside the panel's top-right corner. Default true. */
  showCloseButton?: boolean
  closeButtonLabel?: string
  className?: string
  backdropClassName?: string
}

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",")

const CENTER_FOLDED_CLIP = "inset(48% 48% 48% 48% round 24px)"
const CENTER_OPEN_CLIP = "inset(0% 0% 0% 0% round 24px)"

const CENTER_UNFOLD_EASE = [0.2, 0, 0.2, 1] as const
const CENTER_UNFOLD_TRANSITION = {
  duration: 0.4,
  ease: CENTER_UNFOLD_EASE,
} as const

function getFocusableElements(root: HTMLElement | null) {
  if (!root) return []
  return Array.from(
    root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter((element) => element.tabIndex >= 0)
}

export function CenterMorphModalContent({
  children,
  ariaLabel,
  ariaDescribedBy,
  dismissible = true,
  showCloseButton = false,
  closeButtonLabel = "Close modal",
  className,
  backdropClassName,
}: CenterMorphModalContentProps) {
  const context = useCenterMorphModalContext("CenterMorphModalContent")
  const reduce = useReducedMotion() ?? false
  const [mounted, setMounted] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!context.open) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    const focusFrame = requestAnimationFrame(() => {
      const [firstFocusable] = getFocusableElements(panelRef.current)
      ;(firstFocusable ?? panelRef.current)?.focus()
    })

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && dismissible) {
        event.preventDefault()
        context.setOpen(false)
        return
      }

      if (event.key !== "Tab") return
      const focusable = getFocusableElements(panelRef.current)
      if (focusable.length === 0) {
        event.preventDefault()
        panelRef.current?.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => {
      cancelAnimationFrame(focusFrame)
      window.removeEventListener("keydown", onKeyDown)
      document.body.style.overflow = previousOverflow
      document.getElementById(context.triggerId)?.focus()
    }
  }, [context, dismissible])

  if (!mounted || typeof document === "undefined") return null

  return createPortal(
    <AnimatePresence>
      {context.open ? (
        <PresenceGate>
          {({ isPresent, gate }) => (
            <>
              <motion.button
                type="button"
                aria-label="Dismiss modal"
                tabIndex={-1}
                disabled={!dismissible}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                {...gate}
                transition={{
                  duration: reduce ? 0.1 : 0.25,
                  ease: EASE_OUT,
                }}
                onClick={() => {
                  if (dismissible) context.setOpen(false)
                }}
                className={cn(
                  "pointer-events-auto fixed inset-0 z-50 h-full w-full cursor-default bg-black/40 backdrop-blur-xs transition-colors",
                  backdropClassName,
                )}
              />

              <div
                inert={!isPresent}
                className="pointer-events-none fixed inset-4 z-50 flex items-center justify-center overflow-y-auto"
              >
                <div className="flex w-full flex-col items-center py-8">
                  <motion.div
                    ref={panelRef}
                    id={context.contentId}
                    role="alertdialog"
                    aria-modal="true"
                    aria-label={ariaLabel}
                    aria-describedby={ariaDescribedBy}
                    tabIndex={-1}
                    initial={
                      reduce
                        ? {
                            opacity: 0,
                            scale: 0.98,
                            clipPath: CENTER_OPEN_CLIP,
                          }
                        : { opacity: 1, clipPath: CENTER_FOLDED_CLIP }
                    }
                    animate={{
                      opacity: 1,
                      scale: 1,
                      clipPath: CENTER_OPEN_CLIP,
                    }}
                    exit={
                      reduce
                        ? {
                            opacity: 0,
                            scale: 0.98,
                            clipPath: CENTER_OPEN_CLIP,
                          }
                        : {
                            opacity: 1,
                            clipPath: CENTER_FOLDED_CLIP,
                          }
                    }
                    {...gate}
                    transition={
                      reduce
                        ? { duration: 0.15, ease: EASE_OUT }
                        : CENTER_UNFOLD_TRANSITION
                    }
                    className={cn(
                      "pointer-events-auto relative w-full max-w-[26rem] origin-center overflow-hidden rounded-2xl border border-border/80 bg-popover p-6 text-popover-foreground shadow-2xl will-change-[clip-path]",
                      className,
                    )}
                  >
                    {children}

                    {showCloseButton ? (
                      <motion.button
                        type="button"
                        aria-label={closeButtonLabel}
                        onClick={() => {
                          if (dismissible) context.setOpen(false)
                        }}
                        initial={
                          reduce ? { opacity: 0 } : { opacity: 0, scale: 0.8 }
                        }
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{
                          opacity: 0,
                          scale: reduce ? 1 : 0.88,
                          transition: { duration: 0.1, ease: EASE_OUT },
                        }}
                        transition={{
                          delay: reduce ? 0 : 0.16,
                          duration: reduce ? 0.12 : 0.2,
                          ease: EASE_OUT,
                        }}
                        className="absolute right-4 top-4 inline-flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <HugeiconsIcon icon={Cancel01Icon} size={16} />
                      </motion.button>
                    ) : null}
                  </motion.div>
                </div>
              </div>
            </>
          )}
        </PresenceGate>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
