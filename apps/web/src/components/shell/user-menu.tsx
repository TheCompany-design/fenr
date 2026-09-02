/**
 * User profile menu & floating sidebar card — signed-in identity and actions.
 *
 * Enhanced with @beui/context-menu animation mechanics:
 * - Origin-based clip-morph toggle animation expanding smoothly from the trigger avatar.
 * - Shared layout hover pill gliding seamlessly across menu items with spring physics.
 * - Dedicated floating theme flyout with matching glide pill physics.
 * - Defensive design: robust fallbacks, full keyboard navigation, and reduced-motion compliance.
 */

import {
  Alert02Icon,
  ArrowRight01Icon,
  CreditCardIcon,
  DashboardSpeed01Icon,
  HelpCircleIcon,
  LaptopIcon,
  Logout03Icon,
  Moon02Icon,
  Notification02Icon,
  Search01Icon,
  Settings02Icon,
  SlidersHorizontalIcon,
  Sun03Icon,
  Tick02Icon,
  UserAdd01Icon,
  UserIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import {
  AnimatedDropdown,
  type AnimatedDropdownProps,
} from "@workspace/ui/components/animated-dropdown"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import { Button } from "@workspace/ui/components/button"
import { useSidebar } from "@workspace/ui/components/sidebar"
import { Switch } from "@workspace/ui/components/switch"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import {
  LABEL_ENTER_TRANSITION,
  LABEL_EXIT_TRANSITION,
  REDUCED_TRANSITION,
  SPRING_LAYOUT,
} from "@workspace/ui/lib/ease"
import { cn } from "@workspace/ui/lib/utils"
import { AnimatePresence, m, useReducedMotion } from "motion/react"
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
} from "react"
import { createPortal } from "react-dom"
import { toast } from "sonner"
import { useConfirm } from "@/components/feedback"
import { type ThemeMode, useThemeStore } from "@/components/providers"
import { signOut } from "@/lib/auth-client"
import { initialsOf, type SessionUser } from "./user-utils"

export type { SessionUser }

/**
 * Clean profile identity header card inspired by the reference design.
 * Features avatar, full name, email, and Pro tier badge.
 */
export function UserProfileHeader({ user }: { user?: SessionUser | null }) {
  const displayName =
    user?.name?.trim() || user?.email?.split("@")[0] || "Andrew Garfield"
  const displayEmail = user?.email || "andrew@atlas.com"
  const initials = initialsOf(user)
  const tier = user?.tier?.includes("Pro") ? "Pro" : user?.tier || "Pro"

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-sidebar-border/70 bg-sidebar-accent/40 p-2.5 transition-colors hover:border-sidebar-border hover:bg-sidebar-accent/60">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar className="size-10 shrink-0 rounded-full border border-sidebar-border/80 bg-muted/60 shadow-xs">
          {user?.image ? (
            <AvatarImage alt={displayName} src={user.image} />
          ) : null}
          <AvatarFallback className="font-semibold text-muted-foreground text-sm">
            {initials}
          </AvatarFallback>
        </Avatar>

        <div className="flex min-w-0 flex-col leading-tight">
          <span className="truncate font-semibold text-foreground text-sm tracking-tight">
            {displayName}
          </span>
          <span className="truncate text-muted-foreground text-xs">
            {displayEmail}
          </span>
        </div>
      </div>

      <span className="shrink-0 rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-0.5 font-medium text-[11px] text-blue-600 dark:border-blue-400/30 dark:bg-blue-400/10 dark:text-blue-400">
        {tier}
      </span>
    </div>
  )
}

/** Segmented visual telemetry bar preserved for backward compatibility */
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

const THEME_OPTIONS: ReadonlyArray<{
  mode: ThemeMode
  label: string
  icon: typeof LaptopIcon
}> = [
  { mode: "system", label: "System", icon: LaptopIcon },
  { mode: "light", label: "Light", icon: Sun03Icon },
  { mode: "dark", label: "Dark", icon: Moon02Icon },
]

/** Reusable profile menu items with gliding hover pill, theme submenu, shortcuts and sign-out logic */
export function UserMenuItems({
  user,
  onClose,
}: {
  user?: SessionUser | null
  onClose?: () => void
}) {
  const [pending, setPending] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeThemeId, setActiveThemeId] = useState<string | null>(null)
  const [isThemeSubmenuOpen, setIsThemeSubmenuOpen] = useState(false)
  const [submenuCoords, setSubmenuCoords] = useState<{
    left: number
    top: number
  } | null>(null)
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)

  const themeRowRef = useRef<HTMLButtonElement | null>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const mode = useThemeStore((s) => s.mode)
  const setMode = useThemeStore((s) => s.setMode)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const effectiveMode = mounted ? mode : "system"

  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const reduce = useReducedMotion() ?? false
  const menuId = useId()
  const themeMenuId = useId()

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

  const updateSubmenuPosition = useCallback(() => {
    const el = themeRowRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const submenuWidth = 176
    const spaceRight = window.innerWidth - rect.right
    const left =
      spaceRight >= submenuWidth + 12
        ? rect.right + 6
        : Math.max(8, rect.left - submenuWidth - 6)
    const top = Math.max(8, Math.min(window.innerHeight - 150, rect.top - 6))
    setSubmenuCoords({ left, top })
  }, [])

  const openThemeSubmenu = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
    updateSubmenuPosition()
    setActiveThemeId(effectiveMode)
    setIsThemeSubmenuOpen(true)
  }, [updateSubmenuPosition, effectiveMode])

  const scheduleCloseThemeSubmenu = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
    }
    closeTimerRef.current = setTimeout(() => {
      setIsThemeSubmenuOpen(false)
    }, 200)
  }, [])

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current)
      }
    }
  }, [])

  const onShortcutKeyDown = useEffectEvent((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === ",") {
      e.preventDefault()
      toast.info("Preferences", {
        description: "System preferences and appearance.",
      })
      onClose?.()
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault()
      toast.info("Command menu", {
        description: "Press ⌘K anytime to open the command palette.",
      })
      onClose?.()
    }
    if ((e.metaKey || e.ctrlKey) && e.altKey && e.key.toLowerCase() === "l") {
      e.preventDefault()
      promptSignOut()
    }
  })

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      onShortcutKeyDown(e)
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  return (
    <div
      role="menu"
      aria-label="User menu"
      className="flex flex-col outline-none"
      onMouseLeave={() => {
        setActiveId(null)
        scheduleCloseThemeSubmenu()
      }}
    >
      {/* Top Profile Header replacing old usage stats */}
      <div className="p-1">
        <UserProfileHeader user={user} />
      </div>

      <hr className="my-1.5 h-px border-0 bg-border/60" />

      {/* Main Section 1: Profile, Preferences, Billing */}
      <div className="flex flex-col gap-0.5">
        {/* Your profile */}
        <button
          type="button"
          role="menuitem"
          data-menu-item="true"
          onFocus={() => {
            setActiveId("profile")
            setIsThemeSubmenuOpen(false)
          }}
          onPointerMove={(e) => {
            if (e.pointerType !== "touch") {
              setActiveId("profile")
              setIsThemeSubmenuOpen(false)
            }
          }}
          onClick={() => {
            toast.info("Your profile", {
              description: `Signed in as ${user?.name || user?.email || "User"}.`,
            })
            onClose?.()
          }}
          className="group/item relative isolate flex h-9 w-full cursor-pointer items-center justify-between rounded-xl px-2.5 text-left font-medium text-sidebar-foreground/80 text-sm outline-none select-none transition-colors hover:text-sidebar-foreground focus:text-sidebar-foreground active:scale-[0.98]"
        >
          {activeId === "profile" && (
            <m.span
              layoutId={`${menuId}-glider`}
              className="pointer-events-none absolute inset-0 -z-10 rounded-xl border border-sidebar-border/70 bg-sidebar-accent shadow-xs"
              transition={reduce ? { duration: 0 } : SPRING_LAYOUT}
            />
          )}
          <div className="flex items-center gap-2.5">
            <HugeiconsIcon
              className="size-4 shrink-0 text-muted-foreground transition-colors group-hover/item:text-foreground"
              icon={UserIcon}
              size={16}
            />
            <span className="text-foreground">Your profile</span>
          </div>
        </button>

        {/* Preferences */}
        <button
          type="button"
          role="menuitem"
          data-menu-item="true"
          onFocus={() => {
            setActiveId("preferences")
            setIsThemeSubmenuOpen(false)
          }}
          onPointerMove={(e) => {
            if (e.pointerType !== "touch") {
              setActiveId("preferences")
              setIsThemeSubmenuOpen(false)
            }
          }}
          onClick={() => {
            toast.info("Preferences", {
              description: "System preferences and appearance.",
            })
            onClose?.()
          }}
          className="group/item relative isolate flex h-9 w-full cursor-pointer items-center justify-between rounded-xl px-2.5 text-left font-medium text-sidebar-foreground/80 text-sm outline-none select-none transition-colors hover:text-sidebar-foreground focus:text-sidebar-foreground active:scale-[0.98]"
        >
          {activeId === "preferences" && (
            <m.span
              layoutId={`${menuId}-glider`}
              className="pointer-events-none absolute inset-0 -z-10 rounded-xl border border-sidebar-border/70 bg-sidebar-accent shadow-xs"
              transition={reduce ? { duration: 0 } : SPRING_LAYOUT}
            />
          )}
          <div className="flex items-center gap-2.5">
            <HugeiconsIcon
              className="size-4 shrink-0 text-muted-foreground transition-colors group-hover/item:text-foreground"
              icon={SlidersHorizontalIcon}
              size={16}
            />
            <span className="text-foreground">Preferences</span>
          </div>
          <kbd className="rounded-md border border-border/80 bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground transition-colors group-hover/item:border-border group-hover/item:text-foreground">
            ⌘,
          </kbd>
        </button>

        {/* Plan & billing */}
        <button
          type="button"
          role="menuitem"
          data-menu-item="true"
          onFocus={() => {
            setActiveId("billing")
            setIsThemeSubmenuOpen(false)
          }}
          onPointerMove={(e) => {
            if (e.pointerType !== "touch") {
              setActiveId("billing")
              setIsThemeSubmenuOpen(false)
            }
          }}
          onClick={() => {
            toast.info("Plan & billing", {
              description: "Manage subscription tiers and payment methods.",
            })
            onClose?.()
          }}
          className="group/item relative isolate flex h-9 w-full cursor-pointer items-center justify-between rounded-xl px-2.5 text-left font-medium text-sidebar-foreground/80 text-sm outline-none select-none transition-colors hover:text-sidebar-foreground focus:text-sidebar-foreground active:scale-[0.98]"
        >
          {activeId === "billing" && (
            <m.span
              layoutId={`${menuId}-glider`}
              className="pointer-events-none absolute inset-0 -z-10 rounded-xl border border-sidebar-border/70 bg-sidebar-accent shadow-xs"
              transition={reduce ? { duration: 0 } : SPRING_LAYOUT}
            />
          )}
          <div className="flex items-center gap-2.5">
            <HugeiconsIcon
              className="size-4 shrink-0 text-muted-foreground transition-colors group-hover/item:text-foreground"
              icon={CreditCardIcon}
              size={16}
            />
            <span className="text-foreground">Plan & billing</span>
          </div>
        </button>

        {/* Theme with interactive flyout submenu */}
        <button
          ref={themeRowRef}
          type="button"
          role="menuitem"
          aria-haspopup="menu"
          aria-expanded={isThemeSubmenuOpen}
          data-menu-item="true"
          onFocus={() => {
            setActiveId("theme")
            openThemeSubmenu()
          }}
          onPointerEnter={() => {
            setActiveId("theme")
            openThemeSubmenu()
          }}
          onPointerLeave={scheduleCloseThemeSubmenu}
          onClick={() => {
            if (isThemeSubmenuOpen) {
              setIsThemeSubmenuOpen(false)
            } else {
              openThemeSubmenu()
            }
          }}
          className="group/item relative isolate flex h-9 w-full cursor-pointer items-center justify-between rounded-xl px-2.5 text-left font-medium text-sidebar-foreground/80 text-sm outline-none select-none transition-colors hover:text-sidebar-foreground focus:text-sidebar-foreground active:scale-[0.98]"
        >
          {(activeId === "theme" || isThemeSubmenuOpen) && (
            <m.span
              layoutId={`${menuId}-glider`}
              className="pointer-events-none absolute inset-0 -z-10 rounded-xl border border-sidebar-border/70 bg-sidebar-accent shadow-xs"
              transition={reduce ? { duration: 0 } : SPRING_LAYOUT}
            />
          )}
          <div className="flex items-center gap-2.5">
            <HugeiconsIcon
              className="size-4 shrink-0 text-muted-foreground transition-colors group-hover/item:text-foreground"
              icon={LaptopIcon}
              size={16}
            />
            <span className="text-foreground">Theme</span>
          </div>

          <div className="flex items-center gap-1 text-muted-foreground text-xs">
            <span className="capitalize">{effectiveMode}</span>
            <HugeiconsIcon
              className="size-3.5 transition-transform duration-200 group-hover/item:translate-x-0.5"
              icon={ArrowRight01Icon}
              size={14}
            />
          </div>
        </button>

        {/* Notifications with Switch Toggle */}
        <div
          role="menuitem"
          tabIndex={0}
          data-menu-item="true"
          onFocus={() => {
            setActiveId("notifications")
            setIsThemeSubmenuOpen(false)
          }}
          onKeyDown={(e) => {
            if (e.key === " " || e.key === "Enter") {
              e.preventDefault()
              const next = !notificationsEnabled
              setNotificationsEnabled(next)
              toast.info(
                next ? "Notifications enabled" : "Notifications muted",
                {
                  description: next
                    ? "You will receive system alerts and telemetry updates."
                    : "Activity updates have been paused.",
                },
              )
            }
          }}
          onPointerMove={(e) => {
            if (e.pointerType !== "touch") {
              setActiveId("notifications")
              setIsThemeSubmenuOpen(false)
            }
          }}
          className="group/item relative isolate flex h-9 w-full cursor-pointer items-center justify-between rounded-xl px-2.5 text-left font-medium text-sidebar-foreground/80 text-sm outline-none select-none transition-colors hover:text-sidebar-foreground focus:text-sidebar-foreground"
        >
          {activeId === "notifications" && (
            <m.span
              layoutId={`${menuId}-glider`}
              className="pointer-events-none absolute inset-0 -z-10 rounded-xl border border-sidebar-border/70 bg-sidebar-accent shadow-xs"
              transition={reduce ? { duration: 0 } : SPRING_LAYOUT}
            />
          )}
          <div className="flex items-center gap-2.5">
            <HugeiconsIcon
              className="size-4 shrink-0 text-muted-foreground transition-colors group-hover/item:text-foreground"
              icon={Notification02Icon}
              size={16}
            />
            <span className="text-foreground">Notifications</span>
          </div>

          <Switch
            checked={notificationsEnabled}
            onCheckedChange={(checked) => {
              setNotificationsEnabled(checked)
              toast.info(
                checked ? "Notifications enabled" : "Notifications muted",
                {
                  description: checked
                    ? "You will receive system alerts and telemetry updates."
                    : "Activity updates have been paused.",
                },
              )
            }}
            aria-label="Toggle notifications"
          />
        </div>

        {/* Command menu */}
        <button
          type="button"
          role="menuitem"
          data-menu-item="true"
          onFocus={() => {
            setActiveId("command")
            setIsThemeSubmenuOpen(false)
          }}
          onPointerMove={(e) => {
            if (e.pointerType !== "touch") {
              setActiveId("command")
              setIsThemeSubmenuOpen(false)
            }
          }}
          onClick={() => {
            toast.info("Command menu", {
              description: "Press ⌘K anytime to open the command palette.",
            })
            onClose?.()
          }}
          className="group/item relative isolate flex h-9 w-full cursor-pointer items-center justify-between rounded-xl px-2.5 text-left font-medium text-sidebar-foreground/80 text-sm outline-none select-none transition-colors hover:text-sidebar-foreground focus:text-sidebar-foreground active:scale-[0.98]"
        >
          {activeId === "command" && (
            <m.span
              layoutId={`${menuId}-glider`}
              className="pointer-events-none absolute inset-0 -z-10 rounded-xl border border-sidebar-border/70 bg-sidebar-accent shadow-xs"
              transition={reduce ? { duration: 0 } : SPRING_LAYOUT}
            />
          )}
          <div className="flex items-center gap-2.5">
            <HugeiconsIcon
              className="size-4 shrink-0 text-muted-foreground transition-colors group-hover/item:text-foreground"
              icon={Search01Icon}
              size={16}
            />
            <span className="text-foreground">Command menu</span>
          </div>
          <kbd className="rounded-md border border-border/80 bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground transition-colors group-hover/item:border-border group-hover/item:text-foreground">
            ⌘K
          </kbd>
        </button>
      </div>

      <hr className="my-1.5 h-px border-0 bg-border/60" />

      {/* Main Section 2: Invite teammates, Help & support */}
      <div className="flex flex-col gap-0.5">
        {/* Invite teammates */}
        <button
          type="button"
          role="menuitem"
          data-menu-item="true"
          onFocus={() => {
            setActiveId("invite")
            setIsThemeSubmenuOpen(false)
          }}
          onPointerMove={(e) => {
            if (e.pointerType !== "touch") {
              setActiveId("invite")
              setIsThemeSubmenuOpen(false)
            }
          }}
          onClick={() => {
            toast.info("Invite teammates", {
              description: "Collaboration invitations coming soon.",
            })
            onClose?.()
          }}
          className="group/item relative isolate flex h-9 w-full cursor-pointer items-center justify-between rounded-xl px-2.5 text-left font-medium text-sidebar-foreground/80 text-sm outline-none select-none transition-colors hover:text-sidebar-foreground focus:text-sidebar-foreground active:scale-[0.98]"
        >
          {activeId === "invite" && (
            <m.span
              layoutId={`${menuId}-glider`}
              className="pointer-events-none absolute inset-0 -z-10 rounded-xl border border-sidebar-border/70 bg-sidebar-accent shadow-xs"
              transition={reduce ? { duration: 0 } : SPRING_LAYOUT}
            />
          )}
          <div className="flex items-center gap-2.5">
            <HugeiconsIcon
              className="size-4 shrink-0 text-muted-foreground transition-colors group-hover/item:text-foreground"
              icon={UserAdd01Icon}
              size={16}
            />
            <span className="text-foreground">Invite teammates</span>
          </div>
        </button>

        {/* Help & support */}
        <button
          type="button"
          role="menuitem"
          data-menu-item="true"
          onFocus={() => {
            setActiveId("support")
            setIsThemeSubmenuOpen(false)
          }}
          onPointerMove={(e) => {
            if (e.pointerType !== "touch") {
              setActiveId("support")
              setIsThemeSubmenuOpen(false)
            }
          }}
          onClick={() => {
            toast.info("Help & support", {
              description: "Documentation and customer support desk.",
            })
            onClose?.()
          }}
          className="group/item relative isolate flex h-9 w-full cursor-pointer items-center justify-between rounded-xl px-2.5 text-left font-medium text-sidebar-foreground/80 text-sm outline-none select-none transition-colors hover:text-sidebar-foreground focus:text-sidebar-foreground active:scale-[0.98]"
        >
          {activeId === "support" && (
            <m.span
              layoutId={`${menuId}-glider`}
              className="pointer-events-none absolute inset-0 -z-10 rounded-xl border border-sidebar-border/70 bg-sidebar-accent shadow-xs"
              transition={reduce ? { duration: 0 } : SPRING_LAYOUT}
            />
          )}
          <div className="flex items-center gap-2.5">
            <HugeiconsIcon
              className="size-4 shrink-0 text-muted-foreground transition-colors group-hover/item:text-foreground"
              icon={HelpCircleIcon}
              size={16}
            />
            <span className="text-foreground">Help & support</span>
          </div>
        </button>
      </div>

      <hr className="my-1.5 h-px border-0 bg-border/60" />

      {/* Logout */}
      <div>
        <button
          type="button"
          id="logout"
          role="menuitem"
          data-menu-item="true"
          disabled={pending}
          onFocus={() => {
            setActiveId("logout")
            setIsThemeSubmenuOpen(false)
          }}
          onPointerMove={(e) => {
            if (e.pointerType !== "touch") {
              setActiveId("logout")
              setIsThemeSubmenuOpen(false)
            }
          }}
          onClick={promptSignOut}
          className="group/item relative isolate flex h-9 w-full cursor-pointer items-center justify-between rounded-xl px-2.5 text-left font-medium text-destructive text-sm outline-none select-none transition-colors hover:text-destructive focus:text-destructive active:scale-[0.98]"
        >
          {activeId === "logout" && (
            <m.span
              layoutId={`${menuId}-glider`}
              className="pointer-events-none absolute inset-0 -z-10 rounded-xl border border-destructive/20 bg-destructive/10"
              transition={reduce ? { duration: 0 } : SPRING_LAYOUT}
            />
          )}
          <div className="flex items-center gap-2.5">
            <HugeiconsIcon
              className="size-4 shrink-0 text-destructive"
              icon={Logout03Icon}
              size={16}
            />
            <span className="text-destructive">Logout</span>
          </div>
        </button>
      </div>

      {/* Floating Theme Submenu rendered via Portal with data-animated-dropdown-subcontent */}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {isThemeSubmenuOpen && submenuCoords && (
              <div
                data-animated-dropdown-subcontent=""
                style={{
                  position: "fixed",
                  left: submenuCoords.left,
                  top: submenuCoords.top,
                  zIndex: 120,
                }}
                className="pointer-events-auto [filter:drop-shadow(0_12px_24px_rgba(0,0,0,0.18))] before:absolute before:-inset-2 before:content-[''] before:-z-10"
                onPointerEnter={openThemeSubmenu}
                onPointerLeave={scheduleCloseThemeSubmenu}
              >
                <m.div
                  initial={
                    reduce ? { opacity: 0 } : { opacity: 0, scale: 0.95, x: -6 }
                  }
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={
                    reduce ? { opacity: 0 } : { opacity: 0, scale: 0.95, x: -6 }
                  }
                  transition={reduce ? { duration: 0 } : SPRING_LAYOUT}
                  className="flex w-44 flex-col gap-0.5 rounded-2xl border border-border/80 bg-popover/95 p-1.5 shadow-2xl backdrop-blur-md outline-none"
                  onMouseLeave={() => setActiveThemeId(null)}
                >
                  {THEME_OPTIONS.map(
                    ({ icon: OptionIcon, label, mode: optionMode }) => {
                      const isSelected = effectiveMode === optionMode
                      const isHovered = activeThemeId === optionMode

                      return (
                        <button
                          key={optionMode}
                          type="button"
                          role="menuitem"
                          onFocus={() => setActiveThemeId(optionMode)}
                          onPointerMove={(e) => {
                            if (e.pointerType !== "touch") {
                              setActiveThemeId(optionMode)
                            }
                          }}
                          onPointerDown={(e) => {
                            e.stopPropagation()
                          }}
                          onClick={(e) => {
                            e.stopPropagation()
                            setMode(optionMode)
                          }}
                          className="group/theme-item relative isolate flex h-9 w-full cursor-pointer items-center justify-between rounded-xl px-2.5 text-left font-medium text-foreground text-sm outline-none select-none transition-colors active:scale-[0.98]"
                        >
                          {isHovered && (
                            <m.span
                              layoutId={`${themeMenuId}-glider`}
                              className="pointer-events-none absolute inset-0 -z-10 rounded-xl border border-sidebar-border/70 bg-sidebar-accent shadow-xs"
                              transition={
                                reduce ? { duration: 0 } : SPRING_LAYOUT
                              }
                            />
                          )}

                          <div className="flex items-center gap-2.5">
                            <HugeiconsIcon
                              className="size-4 shrink-0 text-muted-foreground transition-colors group-hover/theme-item:text-foreground"
                              icon={OptionIcon}
                              size={16}
                            />
                            <span>{label}</span>
                          </div>

                          {isSelected && (
                            <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-xs dark:bg-blue-500">
                              <HugeiconsIcon
                                icon={Tick02Icon}
                                size={10}
                                strokeWidth={3}
                              />
                            </span>
                          )}
                        </button>
                      )
                    },
                  )}
                </m.div>
              </div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  )
}

export { AnimatedDropdown, type AnimatedDropdownProps }

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
    user?.name?.trim() || user?.email?.split("@")[0] || "Andrew Garfield"
  const tierName = user?.tier || "Orbit Pro"

  return (
    <Tooltip open={open ? false : undefined}>
      <AnimatedDropdown
        open={open}
        onOpenChange={setOpen}
        side={collapsed ? "right" : "top"}
        align={collapsed ? "center" : "start"}
        sideOffset={10}
        trigger={
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
        }
      >
        {(onClose) => <UserMenuItems user={user} onClose={onClose} />}
      </AnimatedDropdown>
      <TooltipContent
        align="center"
        hidden={!collapsed || isMobile}
        side="right"
      >
        {displayName} — {tierName}
      </TooltipContent>
    </Tooltip>
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
