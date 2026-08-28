/**
 * User profile menu & floating sidebar card — signed-in identity, usage telemetry, and actions.
 *
 * Enhanced with @beui/context-menu animation mechanics:
 * - Origin-based clip-morph toggle animation expanding smoothly from the trigger avatar.
 * - Shared layout hover pill gliding seamlessly across menu items with spring physics.
 * - Defensive design: robust fallbacks, full keyboard navigation, and reduced-motion compliance.
 */

import {
  Alert02Icon,
  DashboardSpeed01Icon,
  HelpCircleIcon,
  Invoice01Icon,
  Logout03Icon,
  Settings02Icon,
  UserIcon,
  Wrench01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import { Button } from "@workspace/ui/components/button"
import { useSidebar } from "@workspace/ui/components/sidebar"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import {
  EASE_OUT,
  LABEL_ENTER_TRANSITION,
  LABEL_EXIT_TRANSITION,
  REDUCED_TRANSITION,
  SPRING_LAYOUT,
} from "@workspace/ui/lib/ease"
import { cn } from "@workspace/ui/lib/utils"
import { AnimatePresence, m, useReducedMotion } from "motion/react"
import {
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useCallback,
  useEffect,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import { createPortal } from "react-dom"
import { toast } from "sonner"
import { useConfirm } from "@/components/feedback"
import { signOut } from "@/lib/auth-client"
import {
  clamp,
  collapsedClip,
  initialsOf,
  type SessionUser,
  useIsMounted,
} from "./user-utils"

export type { SessionUser }

const VIEWPORT_PADDING = 8
const MORPH_DURATION = 0.28

/** Segmented visual telemetry bar with staggered entrance animation and alert state */
export function UsageWidget({
  percent = 90,
  tier = "Fenr Pro",
}: {
  percent?: number
  tier?: string
}) {
  const reduce = useReducedMotion() ?? false
  const totalBars = 10
  const filledBars = Math.min(
    totalBars,
    Math.max(0, Math.round((percent / 100) * totalBars)),
  )

  return (
    <div className="group/usage relative overflow-hidden rounded-xl border border-sidebar-border/80 bg-sidebar-accent/40 p-3 transition-colors hover:border-sidebar-border hover:bg-sidebar-accent/60">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-medium text-foreground text-sm">
          <HugeiconsIcon
            className="text-muted-foreground transition-transform duration-300 group-hover/usage:rotate-12"
            icon={DashboardSpeed01Icon}
            size={16}
          />
          <span>Usage</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Staggered animated segmented indicator */}
          <div
            aria-label={`Usage: ${percent}%`}
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={percent}
            className="flex items-center gap-0.5"
            role="progressbar"
          >
            {Array.from({ length: totalBars }).map((_, i) => {
              const isFilled = i < filledBars
              const isPeak = isFilled && i === filledBars - 1 && percent >= 85

              return (
                <m.div
                  // biome-ignore lint/suspicious/noArrayIndexKey: fixed 10 segment telemetry bars
                  key={i}
                  initial={reduce ? false : { scaleY: 0.3, opacity: 0 }}
                  animate={{ scaleY: 1, opacity: 1 }}
                  transition={
                    reduce
                      ? { duration: 0 }
                      : {
                          delay: 0.04 + i * 0.03,
                          type: "spring",
                          stiffness: 400,
                          damping: 25,
                        }
                  }
                  className={cn(
                    "h-3.5 w-1 origin-bottom rounded-full transition-all duration-300",
                    isFilled
                      ? percent >= 85
                        ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"
                        : "bg-primary"
                      : "bg-muted/40",
                    isPeak && "animate-pulse",
                  )}
                />
              )
            })}
          </div>

          <m.span
            initial={reduce ? false : { scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={
              reduce
                ? { duration: 0 }
                : {
                    delay: 0.3,
                    type: "spring",
                    stiffness: 400,
                    damping: 20,
                  }
            }
            className={cn(
              "flex items-center gap-1 font-semibold text-xs",
              percent >= 85 ? "text-amber-500" : "text-muted-foreground",
            )}
          >
            {percent >= 85 && (
              <HugeiconsIcon
                className="animate-bounce"
                icon={Alert02Icon}
                size={13}
                strokeWidth={2.5}
              />
            )}
            {percent}%
          </m.span>
        </div>
      </div>

      <p className="mt-2 text-[12px] text-muted-foreground leading-relaxed">
        Upgrade to{" "}
        <span className="font-medium text-foreground">
          {tier.replace("Pro", "ULTRA")}
        </span>{" "}
        for extended usage.{" "}
        <button
          type="button"
          aria-label="Learn more about upgrading to Fenr ULTRA"
          className="cursor-pointer font-medium text-foreground underline underline-offset-2 transition-colors hover:text-primary active:scale-95"
          onClick={() => {
            toast.info("Fenr ULTRA", {
              description: "Tier management & billing upgrades coming soon.",
            })
          }}
        >
          Learn more
        </button>
      </p>
    </div>
  )
}

interface MenuItemData {
  id: string
  label: string
  icon: typeof UserIcon
  shortcut?: string
  tone?: "default" | "destructive"
  onClick: () => void
}

/** Reusable profile menu items with gliding hover pill, shortcuts and sign-out logic */
export function UserMenuItems({
  user,
  onClose,
}: {
  user?: SessionUser | null
  onClose?: () => void
}) {
  const [pending, setPending] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const reduce = useReducedMotion() ?? false
  const menuId = useId()

  const confirm = useConfirm()

  const handleSignOut = useCallback(async () => {
    if (pending) return
    setPending(true)
    try {
      const { error } = await signOut()
      if (error) {
        toast.error("Couldn't sign out", {
          description:
            "We couldn't reach the server. Check your connection and try again.",
        })
        return
      }
      toast.success("Signed out")
      await navigate({ to: "/auth/sign-in" })
      queryClient.clear()
    } catch {
      toast.error("Couldn't sign out", {
        description: "Something went wrong. Please try again.",
      })
    } finally {
      setPending(false)
    }
  }, [navigate, pending, queryClient])

  const promptSignOut = useCallback(() => {
    onClose?.()
    confirm({
      title: "Sign out of Fenr?",
      description:
        "You will be logged out of your active session on this device. Any unsaved changes may be lost.",
      confirmText: "Sign out",
      cancelText: "Cancel",
      variant: "destructive",
      onConfirm: handleSignOut,
    })
  }, [confirm, handleSignOut, onClose])

  const onShortcutKeyDown = useEffectEvent((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === ",") {
      e.preventDefault()
      toast.info("Settings", {
        description: "Global system preferences panel coming soon.",
      })
      onClose?.()
    }
    if ((e.metaKey || e.ctrlKey) && e.altKey && e.key.toLowerCase() === "l") {
      e.preventDefault()
      promptSignOut()
    }
  })

  // Keyboard shortcut listener for ⌘, (Settings) and ⌘⌥L (Logout)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      onShortcutKeyDown(e)
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  const usagePercent = user?.usagePercent ?? 90
  const userTier = user?.tier ?? "Orbit Pro"

  const navItems: MenuItemData[] = [
    {
      id: "profile",
      icon: UserIcon,
      label: "Profile",
      onClick: () => {
        toast.info("Profile", {
          description: `Signed in as ${user?.name || user?.email || "User"}.`,
        })
      },
    },
    {
      id: "billing",
      icon: Invoice01Icon,
      label: "Billing",
      onClick: () => {
        toast.info("Billing", {
          description: "Manage subscription tiers and payment methods.",
        })
      },
    },
    {
      id: "settings",
      icon: Wrench01Icon,
      label: "Settings",
      shortcut: "⌘,",
      onClick: () => {
        toast.info("Settings", {
          description: "System preferences and appearance.",
        })
      },
    },
    {
      id: "support",
      icon: HelpCircleIcon,
      label: "Support",
      onClick: () => {
        toast.info("Support", {
          description: "Documentation and customer support desk.",
        })
      },
    },
  ]

  const logoutItem: MenuItemData = {
    id: "logout",
    icon: Logout03Icon,
    label: "Logout",
    shortcut: "⌘⌥L",
    tone: "destructive",
    onClick: promptSignOut,
  }

  const renderItem = (item: MenuItemData) => {
    const isActive = activeId === item.id
    const isDestructive = item.tone === "destructive"

    return (
      <button
        key={item.id}
        type="button"
        id={item.id}
        role="menuitem"
        data-menu-item="true"
        disabled={isDestructive && pending}
        onFocus={() => setActiveId(item.id)}
        onPointerMove={(e) => {
          if (e.pointerType !== "touch") {
            setActiveId(item.id)
          }
        }}
        onClick={() => {
          item.onClick()
          if (!isDestructive) {
            onClose?.()
          }
        }}
        className={cn(
          "group/item relative isolate flex h-9 w-full cursor-pointer items-center justify-between rounded-xl px-2.5 text-left font-medium text-sm outline-none select-none transition-colors",
          isDestructive
            ? "text-destructive hover:text-destructive focus:text-destructive"
            : "text-sidebar-foreground/80 hover:text-sidebar-foreground focus:text-sidebar-foreground",
          "active:scale-[0.98]",
        )}
      >
        {/* Animated Glide Pill matching @beui/context-menu mechanics */}
        {isActive ? (
          <m.span
            layoutId={`${menuId}-glider`}
            className={cn(
              "absolute inset-0 -z-10 rounded-xl",
              isDestructive
                ? "border border-destructive/20 bg-destructive/10"
                : "border border-sidebar-border/70 bg-sidebar-accent shadow-xs",
            )}
            transition={reduce ? { duration: 0 } : SPRING_LAYOUT}
          />
        ) : null}

        <div className="flex items-center gap-2.5">
          <HugeiconsIcon
            className={cn(
              "size-4 shrink-0 transition-colors",
              isDestructive
                ? "text-destructive"
                : "text-muted-foreground group-hover/item:text-foreground",
            )}
            icon={item.icon}
            size={16}
          />
          <span
            className={isDestructive ? "text-destructive" : "text-foreground"}
          >
            {item.label}
          </span>
        </div>

        {item.shortcut && (
          <kbd
            className={cn(
              "rounded-md px-1.5 py-0.5 font-mono text-[10px] transition-colors",
              isDestructive
                ? "border border-destructive/30 bg-destructive/10 text-destructive"
                : "border border-border/80 bg-muted/60 text-muted-foreground group-hover/item:border-border group-hover/item:text-foreground",
            )}
          >
            {item.shortcut}
          </kbd>
        )}
      </button>
    )
  }

  return (
    <div
      role="menu"
      aria-label="User menu"
      className="flex flex-col outline-none"
      onMouseLeave={() => setActiveId(null)}
    >
      <div className="p-1">
        <UsageWidget percent={usagePercent} tier={userTier} />
      </div>

      <hr className="my-1.5 h-px border-0 bg-border/60" />

      <div className="flex flex-col gap-1">{navItems.map(renderItem)}</div>

      <hr className="my-1.5 h-px border-0 bg-border/60" />

      <div>{renderItem(logoutItem)}</div>
    </div>
  )
}

interface AnimatedDropdownProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  trigger: ReactElement
  side?: "top" | "bottom" | "right" | "left"
  align?: "start" | "center" | "end"
  sideOffset?: number
  className?: string
  children: (onClose: () => void) => ReactNode
}

/**
 * High-performance animated dropdown container leveraging @beui/context-menu clip-path morph mechanics.
 * Supports button trigger origin calculation, keyboard navigation, outside-click, and viewport constraints.
 */
export function AnimatedDropdown({
  open,
  onOpenChange,
  trigger,
  side = "top",
  align = "start",
  sideOffset = 8,
  className,
  children,
}: AnimatedDropdownProps) {
  const mounted = useIsMounted()
  const triggerRef = useRef<HTMLElement | null>(null)
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
    if (!triggerRef.current || !contentRef.current) return
    const triggerRect = triggerRef.current.getBoundingClientRect()
    const contentRect = contentRef.current.getBoundingClientRect()

    let left = triggerRect.left
    let top = triggerRect.top

    if (side === "top") {
      top = triggerRect.top - contentRect.height - sideOffset
      if (align === "start") left = triggerRect.left
      else if (align === "end") left = triggerRect.right - contentRect.width
      else left = triggerRect.left + (triggerRect.width - contentRect.width) / 2
    } else if (side === "bottom") {
      top = triggerRect.bottom + sideOffset
      if (align === "start") left = triggerRect.left
      else if (align === "end") left = triggerRect.right - contentRect.width
      else left = triggerRect.left + (triggerRect.width - contentRect.width) / 2
    } else if (side === "right") {
      left = triggerRect.right + sideOffset
      if (align === "center") {
        top = triggerRect.top + (triggerRect.height - contentRect.height) / 2
      } else if (align === "end") {
        top = triggerRect.bottom - contentRect.height
      } else {
        top = triggerRect.top
      }
    } else if (side === "left") {
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
  }, [side, align, sideOffset])

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
      if (
        contentRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      ) {
        return
      }
      onOpenChange(false)
    }

    const onWindowChange = () => {
      onOpenChange(false)
    }

    window.addEventListener("pointerdown", onPointerDown)
    window.addEventListener("resize", onWindowChange)
    window.addEventListener("scroll", onWindowChange, { passive: true })

    return () => {
      window.removeEventListener("pointerdown", onPointerDown)
      window.removeEventListener("resize", onWindowChange)
      window.removeEventListener("scroll", onWindowChange)
    }
  }, [open, onOpenChange])

  // Keyboard navigation
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault()
      onOpenChange(false)
      triggerRef.current?.focus()
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
          triggerRef.current = node
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
              data-user-menu-portal=""
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
              <m.div
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
                  "w-72 overflow-hidden rounded-2xl border border-border/80 bg-sidebar/95 p-1.5 shadow-2xl backdrop-blur-md outline-none",
                  className,
                )}
              >
                {children(() => onOpenChange(false))}
              </m.div>
            </div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
}

/**
 * Detached, animated UserCard for the floating sidebar footer.
 * Morphs seamlessly between wide card and collapsed avatar rail.
 */
export function UserCard({
  user,
  className,
}: {
  user?: SessionUser | null
  className?: string
}) {
  const { state, isMobile } = useSidebar()
  const reduce = useReducedMotion() ?? false
  const collapsed = state === "collapsed" && !isMobile
  const [open, setOpen] = useState(false)

  const displayName =
    user?.name?.trim() || user?.email?.split("@")[0] || "jamie"
  const tierName = user?.tier || "Orbit Pro"

  return (
    <AnimatedDropdown
      open={open}
      onOpenChange={setOpen}
      side={collapsed ? "right" : "top"}
      align={collapsed ? "center" : "start"}
      sideOffset={10}
      trigger={
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                aria-label="User account menu"
                className={cn(
                  "group/user-card relative flex h-11 w-full min-w-0 cursor-pointer items-center overflow-hidden rounded-2xl border border-sidebar-border/70 bg-sidebar-accent/30 p-0 text-left outline-none transition-all",
                  "hover:border-sidebar-border hover:bg-sidebar-accent/70 hover:shadow-xs",
                  "focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar active:scale-[0.98]",
                  open &&
                    "border-sidebar-border bg-sidebar-accent/70 shadow-xs",
                  className,
                )}
              />
            }
          >
            {/* Avatar anchor: constant size-11 for rock-solid coordinate locking */}
            <div className="relative z-10 flex size-11 shrink-0 items-center justify-center">
              <Avatar className="size-8 rounded-full ring-1 ring-border/60">
                {user?.image ? (
                  <AvatarImage alt={displayName} src={user.image} />
                ) : null}
                <AvatarFallback className="font-semibold text-xs">
                  {initialsOf(user)}
                </AvatarFallback>
              </Avatar>
            </div>

            {/* User info + flair + trailing settings cog */}
            <m.div
              initial={false}
              animate={{
                opacity: collapsed ? 0 : 1,
                x: collapsed ? -8 : 0,
              }}
              transition={
                reduce
                  ? REDUCED_TRANSITION
                  : collapsed
                    ? LABEL_EXIT_TRANSITION
                    : LABEL_ENTER_TRANSITION
              }
              aria-hidden={collapsed}
              className={cn(
                "relative z-10 flex min-w-0 flex-1 items-center justify-between overflow-hidden whitespace-nowrap pl-1 pr-2.5",
                collapsed && "pointer-events-none",
              )}
            >
              <div className="flex min-w-0 flex-col leading-tight">
                <span className="flex items-center gap-1 font-semibold text-foreground text-sm tracking-tight">
                  <span className="truncate">{displayName}</span>
                  <span className="text-amber-500">🌾</span>
                </span>
                <span className="truncate font-medium text-[11px] text-muted-foreground">
                  {tierName}
                </span>
              </div>

              <HugeiconsIcon
                className={cn(
                  "size-4 shrink-0 text-muted-foreground transition-transform duration-300 group-hover/user-card:rotate-45 group-hover/user-card:text-foreground",
                  open && "rotate-90 text-foreground",
                )}
                icon={Settings02Icon}
              />
            </m.div>
          </TooltipTrigger>
          <TooltipContent
            align="center"
            hidden={!collapsed || isMobile}
            side="right"
          >
            {displayName} — {tierName}
          </TooltipContent>
        </Tooltip>
      }
    >
      {(onClose) => <UserMenuItems user={user} onClose={onClose} />}
    </AnimatedDropdown>
  )
}

/** Legacy / Top bar compact avatar menu */
export function UserMenu({
  user,
  className,
}: {
  user?: SessionUser | null
  className?: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <AnimatedDropdown
      open={open}
      onOpenChange={setOpen}
      side="bottom"
      align="end"
      sideOffset={8}
      className="bg-popover/95"
      trigger={
        <Button
          aria-label="Open profile menu"
          className={cn(
            "size-9 cursor-pointer overflow-hidden rounded-full p-0 transition-transform active:scale-95",
            className,
          )}
          size="icon"
          variant="ghost"
        >
          <Avatar className="size-full">
            {user?.image ? <AvatarImage alt="" src={user.image} /> : null}
            <AvatarFallback className="font-semibold text-xs">
              {initialsOf(user)}
            </AvatarFallback>
          </Avatar>
        </Button>
      }
    >
      {(onClose) => <UserMenuItems user={user} onClose={onClose} />}
    </AnimatedDropdown>
  )
}
