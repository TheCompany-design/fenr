"use client"

import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { SidebarLeftIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Separator } from "@workspace/ui/components/separator"
import { SharedLayoutBg } from "@workspace/ui/components/shared-layout-bg"
import { Skeleton } from "@workspace/ui/components/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import {
  EASE_DRAWER,
  EASE_OUT,
  REDUCED_TRANSITION,
  SIDEBAR_MORPH_TRANSITION,
  SPRING_LAYOUT,
} from "@workspace/ui/lib/ease"
import { cn } from "@workspace/ui/lib/utils"
import {
  AnimatePresence,
  type HTMLMotionProps,
  motion,
  useReducedMotion,
  type Variants,
} from "motion/react"
import * as React from "react"
import { createPortal } from "react-dom"

type SidebarState = "expanded" | "collapsed"
type SidebarSide = "left" | "right"
type SidebarVariant = "sidebar" | "floating" | "inset"
type SidebarCollapsible = "offcanvas" | "icon" | "none"

const SIDEBAR_COOKIE_NAME = "sidebar_state"
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7
const MOBILE_QUERY = "(max-width: 767px)"
const SIDEBAR_KEYBOARD_SHORTCUT = "b"

const PANEL_TRANSITION = {
  duration: 0.32,
  ease: EASE_DRAWER,
} as const

const SUBMENU_VARIANTS: Variants = {
  closed: {
    opacity: 0,
    clipPath: "inset(0 0 100% 0 round 8px)",
    transition: {
      duration: 0.14,
      ease: EASE_OUT,
      staggerChildren: 0.025,
      staggerDirection: -1,
    },
  },
  open: {
    opacity: 1,
    clipPath: "inset(0 0 0% 0 round 8px)",
    transition: {
      duration: 0.2,
      delayChildren: 0.035,
      ease: EASE_OUT,
      staggerChildren: 0.045,
    },
  },
}

const SUBMENU_ITEM_VARIANTS: Variants = {
  closed: {
    opacity: 0,
    y: -6,
    filter: "blur(3px)",
  },
  open: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      duration: 0.18,
      ease: EASE_OUT,
    },
  },
}

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",")

function subscribeToMobileQuery(callback: () => void) {
  if (typeof window === "undefined") return () => {}
  const query = window.matchMedia(MOBILE_QUERY)
  query.addEventListener("change", callback)
  return () => query.removeEventListener("change", callback)
}

function getMobileSnapshot() {
  if (typeof window === "undefined") return false
  return window.matchMedia(MOBILE_QUERY).matches
}

function getServerMobileSnapshot() {
  return false
}

export function useIsMobile() {
  return React.useSyncExternalStore(
    subscribeToMobileQuery,
    getMobileSnapshot,
    getServerMobileSnapshot,
  )
}

export interface SidebarContextProps {
  state: SidebarState
  open: boolean
  setOpen: (open: boolean | ((prev: boolean) => boolean)) => void
  openMobile: boolean
  setOpenMobile: (open: boolean | ((prev: boolean) => boolean)) => void
  isMobile: boolean
  toggleSidebar: () => void
  layoutId: string
  reduce: boolean
  triggerRef: React.RefObject<HTMLButtonElement | null>
}

const SidebarContext = React.createContext<SidebarContextProps | null>(null)

export function useSidebar() {
  const context = React.useContext(SidebarContext)
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.")
  }
  return context
}

interface SidebarPanelContextProps {
  collapsed: boolean
  collapsible: SidebarCollapsible
  side: SidebarSide
}

const SidebarPanelContext =
  React.createContext<SidebarPanelContextProps | null>(null)

export function useSidebarPanel() {
  const context = React.useContext(SidebarPanelContext)
  if (!context) {
    throw new Error("Sidebar parts must be used inside a Sidebar component.")
  }
  return context
}

type SidebarProviderStyle = React.CSSProperties & {
  "--sidebar-width"?: string
  "--sidebar-width-icon"?: string
  "--sidebar-width-mobile"?: string
}

export interface SidebarProviderProps
  extends React.HTMLAttributes<HTMLDivElement> {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  openMobile?: boolean
  defaultOpenMobile?: boolean
  onOpenMobileChange?: (open: boolean) => void
  style?: SidebarProviderStyle
}

export function SidebarProvider({
  children,
  open: openProp,
  defaultOpen = true,
  onOpenChange: setOpenProp,
  openMobile: openMobileProp,
  defaultOpenMobile = false,
  onOpenMobileChange: setOpenMobileProp,
  className,
  style,
  ...props
}: SidebarProviderProps) {
  const isMobile = useIsMobile()
  const reduce = useReducedMotion() ?? false
  const generatedId = React.useId()
  const triggerRef = React.useRef<HTMLButtonElement | null>(null)

  const [_open, _setOpen] = React.useState(defaultOpen)
  const [_openMobile, _setOpenMobile] = React.useState(defaultOpenMobile)

  const open = openProp ?? _open
  const openMobile = openMobileProp ?? _openMobile

  const setOpen = React.useCallback(
    (value: boolean | ((prev: boolean) => boolean)) => {
      const resolved = typeof value === "function" ? value(open) : value
      if (openProp === undefined) _setOpen(resolved)
      setOpenProp?.(resolved)

      // SSR Cookie persistence
      // biome-ignore lint/suspicious/noDocumentCookie: cookie write for SSR state
      document.cookie = `${SIDEBAR_COOKIE_NAME}=${resolved}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}; samesite=lax`
    },
    [open, openProp, setOpenProp],
  )

  const setOpenMobile = React.useCallback(
    (value: boolean | ((prev: boolean) => boolean)) => {
      const resolved = typeof value === "function" ? value(openMobile) : value
      if (openMobileProp === undefined) _setOpenMobile(resolved)
      setOpenMobileProp?.(resolved)
    },
    [openMobile, openMobileProp, setOpenMobileProp],
  )

  const toggleSidebar = React.useCallback(() => {
    if (isMobile) setOpenMobile((prev) => !prev)
    else setOpen((prev) => !prev)
  }, [isMobile, setOpen, setOpenMobile])

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() === SIDEBAR_KEYBOARD_SHORTCUT &&
        (event.metaKey || event.ctrlKey)
      ) {
        event.preventDefault()
        toggleSidebar()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [toggleSidebar])

  const state: SidebarState = open ? "expanded" : "collapsed"

  const contextValue = React.useMemo<SidebarContextProps>(
    () => ({
      state,
      open,
      setOpen,
      openMobile,
      setOpenMobile,
      isMobile,
      toggleSidebar,
      layoutId: `${generatedId}-sidebar-active-pill`,
      reduce,
      triggerRef,
    }),
    [
      state,
      open,
      setOpen,
      openMobile,
      setOpenMobile,
      isMobile,
      toggleSidebar,
      generatedId,
      reduce,
    ],
  )

  return (
    <SidebarContext.Provider value={contextValue}>
      <div
        data-slot="sidebar-wrapper"
        data-state={state}
        style={
          {
            "--sidebar-width": "17.5rem",
            "--sidebar-width-icon": "4.5rem",
            "--sidebar-width-mobile": "19rem",
            ...style,
          } as React.CSSProperties
        }
        className={cn(
          "group/sidebar-wrapper flex min-h-svh w-full min-w-0 has-data-[variant=inset]:bg-sidebar",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </SidebarContext.Provider>
  )
}

function MobileSidebarDrawer({
  ariaLabel,
  children,
  className,
  side,
}: {
  ariaLabel: string
  children: React.ReactNode
  className?: string
  side: SidebarSide
}) {
  const context = useSidebar()
  const panelRef = React.useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = React.useState(false)
  const [hidden, setHidden] = React.useState(!context.openMobile)
  const openMobileRef = React.useRef(context.openMobile)

  React.useEffect(() => setMounted(true), [])

  React.useEffect(() => {
    openMobileRef.current = context.openMobile
    if (context.openMobile) setHidden(false)
  }, [context.openMobile])

  React.useEffect(() => {
    if (!context.openMobile) return

    const body = document.body
    const scrollY = window.scrollY
    const previousBodyStyles = {
      left: body.style.left,
      overflow: body.style.overflow,
      position: body.style.position,
      right: body.style.right,
      top: body.style.top,
    }

    body.style.position = "fixed"
    body.style.top = `-${scrollY}px`
    body.style.left = "0"
    body.style.right = "0"
    body.style.overflow = "hidden"

    const focusFrame = requestAnimationFrame(() => {
      const firstFocusable =
        panelRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
      ;(firstFocusable ?? panelRef.current)?.focus({ preventScroll: true })
    })

    return () => {
      cancelAnimationFrame(focusFrame)
      body.style.position = previousBodyStyles.position
      body.style.top = previousBodyStyles.top
      body.style.left = previousBodyStyles.left
      body.style.right = previousBodyStyles.right
      body.style.overflow = previousBodyStyles.overflow
      window.scrollTo(0, scrollY)
      context.triggerRef.current?.focus({ preventScroll: true })
    }
  }, [context.openMobile, context.triggerRef])

  if (!mounted) return null

  return createPortal(
    <div
      className={cn(
        "pointer-events-none fixed inset-0 z-50 md:hidden",
        hidden && !context.openMobile ? "invisible" : "visible",
      )}
    >
      <motion.button
        type="button"
        aria-label="Close sidebar"
        tabIndex={context.openMobile ? 0 : -1}
        initial={false}
        animate={{ opacity: context.openMobile ? 1 : 0 }}
        transition={context.reduce ? REDUCED_TRANSITION : PANEL_TRANSITION}
        onClick={() => context.setOpenMobile(false)}
        className={cn(
          "fixed inset-0 bg-black/50 backdrop-blur-xs",
          context.openMobile ? "pointer-events-auto" : "pointer-events-none",
        )}
      />

      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        aria-hidden={!context.openMobile}
        inert={!context.openMobile}
        tabIndex={-1}
        data-mobile="true"
        data-state={context.openMobile ? "expanded" : "collapsed"}
        data-side={side}
        initial={false}
        animate={{
          opacity: context.reduce ? (context.openMobile ? 1 : 0) : 1,
          x: context.reduce
            ? 0
            : context.openMobile
              ? "0%"
              : side === "left"
                ? "-100%"
                : "100%",
        }}
        transition={context.reduce ? REDUCED_TRANSITION : PANEL_TRANSITION}
        onAnimationComplete={() => {
          if (!openMobileRef.current) setHidden(true)
        }}
        onKeyDown={(event: React.KeyboardEvent<HTMLDivElement>) => {
          if (event.key === "Escape") {
            event.preventDefault()
            context.setOpenMobile(false)
            return
          }

          if (event.key !== "Tab") return
          const focusable = panelRef.current
            ? Array.from(
                panelRef.current.querySelectorAll<HTMLElement>(
                  FOCUSABLE_SELECTOR,
                ),
              )
            : []

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
        }}
        className={cn(
          "pointer-events-auto fixed inset-y-0 flex h-dvh w-(--sidebar-width-mobile) max-w-[88vw] flex-col overflow-hidden",
          "border-border bg-sidebar text-sidebar-foreground shadow-2xl will-change-transform",
          side === "left" ? "left-0 border-r" : "right-0 border-l",
          !context.openMobile && "pointer-events-none",
          className,
        )}
      >
        <SidebarPanelContext.Provider
          value={{ collapsed: false, collapsible: "none", side }}
        >
          {children}
        </SidebarPanelContext.Provider>
      </motion.div>
    </div>,
    document.body,
  )
}

export interface SidebarProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "children"> {
  children?: React.ReactNode
  side?: SidebarSide
  variant?: SidebarVariant
  collapsible?: SidebarCollapsible
  ariaLabel?: string
  panelClassName?: string
}

export const Sidebar = React.forwardRef<HTMLElement, SidebarProps>(
  function Sidebar(
    {
      side = "left",
      variant = "floating",
      collapsible = "icon",
      ariaLabel = "Sidebar",
      children,
      className,
      panelClassName,
      style,
      ...props
    },
    forwardedRef,
  ) {
    const context = useSidebar()
    const collapsed = collapsible !== "none" && !context.open
    const offcanvas = collapsed && collapsible === "offcanvas"

    const targetWidth = offcanvas
      ? "0px"
      : collapsed
        ? "var(--sidebar-width-icon)"
        : "var(--sidebar-width)"

    const targetGapWidth = offcanvas
      ? "0px"
      : collapsed
        ? "var(--sidebar-width-icon)"
        : "var(--sidebar-width)"

    if (context.isMobile) {
      return (
        <MobileSidebarDrawer
          ariaLabel={ariaLabel}
          className={className}
          side={side}
        >
          {children}
        </MobileSidebarDrawer>
      )
    }

    return (
      <aside
        ref={forwardedRef}
        aria-label={ariaLabel}
        data-slot="sidebar"
        data-state={collapsed ? "collapsed" : "expanded"}
        data-collapsible={collapsed ? collapsible : ""}
        data-variant={variant}
        data-side={side}
        style={style}
        className={cn(
          "group group/sidebar peer relative hidden h-auto shrink-0 md:block text-sidebar-foreground",
          side === "right" && "order-last",
          className,
        )}
        {...props}
      >
        {/* Desktop layout gap tracking */}
        <motion.div
          data-slot="sidebar-gap"
          initial={false}
          animate={{ width: targetGapWidth }}
          transition={
            context.reduce ? { duration: 0 } : SIDEBAR_MORPH_TRANSITION
          }
          className={cn(
            "relative bg-transparent will-change-[width]",
            side === "right" && "rotate-180",
          )}
        />

        <motion.div
          data-slot="sidebar-container"
          initial={false}
          animate={{
            width: targetWidth,
            opacity: offcanvas ? 0 : 1,
            x: offcanvas ? (side === "left" ? "-100%" : "100%") : "0%",
          }}
          transition={
            context.reduce ? { duration: 0 } : SIDEBAR_MORPH_TRANSITION
          }
          className={cn(
            "fixed inset-y-0 z-10 hidden h-svh will-change-[width,transform] data-[side=left]:left-0 data-[side=right]:right-0 md:flex",
            variant === "floating" || variant === "inset"
              ? "p-2"
              : side === "left"
                ? "border-border border-r"
                : "border-border border-l",
            panelClassName,
          )}
        >
          <div
            data-sidebar="sidebar"
            data-slot="sidebar-inner"
            className={cn(
              "flex size-full flex-col bg-sidebar text-sidebar-foreground overflow-hidden",
              variant === "floating" &&
                "rounded-2xl border border-border bg-sidebar/95 shadow-xs backdrop-blur-md",
              variant === "inset" && "rounded-xl shadow-xs",
            )}
          >
            <SidebarPanelContext.Provider
              value={{ collapsed, collapsible, side }}
            >
              {children}
            </SidebarPanelContext.Provider>
          </div>
        </motion.div>
      </aside>
    )
  },
)

export interface SidebarTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

export const SidebarTrigger = React.forwardRef<
  HTMLButtonElement,
  SidebarTriggerProps
>(function SidebarTrigger(
  { className, onClick, type = "button", ...props },
  forwardedRef,
) {
  const context = useSidebar()
  const expanded = context.isMobile ? context.openMobile : context.open

  return (
    <Button
      {...props}
      ref={(node) => {
        context.triggerRef.current = node
        if (typeof forwardedRef === "function") forwardedRef(node)
        else if (forwardedRef) forwardedRef.current = node
      }}
      type={type}
      variant="ghost"
      size="icon-sm"
      aria-label={props["aria-label"] ?? "Toggle sidebar"}
      aria-expanded={expanded}
      data-slot="sidebar-trigger"
      data-sidebar="trigger"
      data-state={expanded ? "expanded" : "collapsed"}
      onClick={(event) => {
        onClick?.(event)
        if (!event.defaultPrevented) context.toggleSidebar()
      }}
      className={cn("size-9 rounded-full", className)}
    >
      <HugeiconsIcon icon={SidebarLeftIcon} />
      <span className="sr-only">Toggle Sidebar</span>
    </Button>
  )
})

export interface SidebarRailProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

export const SidebarRail = React.forwardRef<
  HTMLButtonElement,
  SidebarRailProps
>(function SidebarRail(
  { className, onClick, type = "button", ...props },
  forwardedRef,
) {
  const context = useSidebar()
  const panel = useSidebarPanel()

  return (
    <button
      {...props}
      ref={forwardedRef}
      type={type}
      data-side={panel.side}
      data-slot="sidebar-rail"
      data-sidebar="rail"
      aria-label={props["aria-label"] ?? "Toggle sidebar"}
      title="Toggle sidebar"
      tabIndex={-1}
      onClick={(event) => {
        onClick?.(event)
        if (!event.defaultPrevented) context.toggleSidebar()
      }}
      className={cn(
        "absolute inset-y-0 z-20 hidden w-4 -translate-x-1/2 outline-none md:block",
        "after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] after:bg-transparent after:transition-colors hover:after:bg-sidebar-border",
        "data-[side=right]:right-0 data-[side=right]:translate-x-1/2 data-[side=left]:left-full",
        className,
      )}
    />
  )
})

export interface SidebarInsetProps extends React.HTMLAttributes<HTMLElement> {}

export const SidebarInset = React.forwardRef<HTMLElement, SidebarInsetProps>(
  function SidebarInset({ className, ...props }, forwardedRef) {
    return (
      <main
        {...props}
        ref={forwardedRef}
        data-slot="sidebar-inset"
        className={cn(
          "relative flex min-h-svh min-w-0 flex-1 flex-col bg-background",
          "md:peer-data-[variant=inset]:m-2 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-2xl md:peer-data-[variant=inset]:shadow-sm",
          className,
        )}
      />
    )
  },
)

export const SidebarHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(function SidebarHeader({ className, ...props }, forwardedRef) {
  return (
    <div
      {...props}
      ref={forwardedRef}
      data-slot="sidebar-header"
      data-sidebar="header"
      className={cn("flex shrink-0 flex-col gap-2 p-2", className)}
    />
  )
})

export const SidebarFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(function SidebarFooter({ className, ...props }, forwardedRef) {
  return (
    <div
      {...props}
      ref={forwardedRef}
      data-slot="sidebar-footer"
      data-sidebar="footer"
      className={cn(
        "flex shrink-0 flex-col gap-2 border-border border-t p-2.5",
        className,
      )}
    />
  )
})

export const SidebarContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(function SidebarContent({ className, ...props }, forwardedRef) {
  return (
    <div
      {...props}
      ref={forwardedRef}
      data-slot="sidebar-content"
      data-sidebar="content"
      className={cn(
        "no-scrollbar flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden p-2",
        className,
      )}
    />
  )
})

export const SidebarSeparator = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof Separator>
>(function SidebarSeparator({ className, ...props }, forwardedRef) {
  return (
    <Separator
      {...props}
      ref={forwardedRef}
      data-slot="sidebar-separator"
      data-sidebar="separator"
      className={cn("mx-2 w-auto bg-sidebar-border", className)}
    />
  )
})

export const SidebarInput = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<typeof Input>
>(function SidebarInput({ className, ...props }, forwardedRef) {
  return (
    <Input
      {...props}
      ref={forwardedRef}
      data-slot="sidebar-input"
      data-sidebar="input"
      className={cn("h-8 w-full bg-background shadow-none", className)}
    />
  )
})

export const SidebarGroup = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(function SidebarGroup({ className, ...props }, forwardedRef) {
  return (
    <div
      {...props}
      ref={forwardedRef}
      data-slot="sidebar-group"
      data-sidebar="group"
      className={cn("relative flex w-full min-w-0 flex-col p-1.5", className)}
    />
  )
})

export const SidebarGroupLabel = React.forwardRef<
  HTMLDivElement,
  useRender.ComponentProps<"div"> & React.HTMLAttributes<HTMLDivElement>
>(function SidebarGroupLabel(
  { children, className, render, ...props },
  forwardedRef,
) {
  const { collapsed } = useSidebarPanel()

  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        ref: forwardedRef,
        "aria-hidden": collapsed,
        className: cn(
          "mb-1 flex h-7 items-center overflow-hidden px-2 text-[11px] font-medium tracking-wider text-muted-foreground transition-opacity",
          collapsed ? "opacity-0" : "opacity-100",
          className,
        ),
        children,
      },
      props,
    ),
    render,
    state: {
      slot: "sidebar-group-label",
      sidebar: "group-label",
    },
  })
})

export const SidebarGroupAction = React.forwardRef<
  HTMLButtonElement,
  useRender.ComponentProps<"button"> & React.ComponentProps<"button">
>(function SidebarGroupAction({ className, render, ...props }, forwardedRef) {
  return useRender({
    defaultTagName: "button",
    props: mergeProps<"button">(
      {
        ref: forwardedRef,
        className: cn(
          "absolute top-3.5 right-3 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-sidebar-foreground ring-sidebar-ring outline-hidden transition-transform group-data-[collapsible=icon]:hidden after:absolute after:-inset-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 md:after:hidden [&>svg]:size-4 [&>svg]:shrink-0",
          className,
        ),
      },
      props,
    ),
    render,
    state: {
      slot: "sidebar-group-action",
      sidebar: "group-action",
    },
  })
})

export const SidebarGroupContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(function SidebarGroupContent({ className, ...props }, forwardedRef) {
  return (
    <div
      {...props}
      ref={forwardedRef}
      data-slot="sidebar-group-content"
      data-sidebar="group-content"
      className={cn("w-full min-w-0", className)}
    />
  )
})

export interface SidebarMenuProps
  extends React.HTMLAttributes<HTMLUListElement> {
  enableHoverGlider?: boolean
}

export const SidebarMenu = React.forwardRef<HTMLUListElement, SidebarMenuProps>(
  function SidebarMenu(
    { children, className, enableHoverGlider = true, ...props },
    forwardedRef,
  ) {
    if (enableHoverGlider) {
      return (
        <SharedLayoutBg
          {...props}
          ref={forwardedRef as React.Ref<HTMLElement>}
          as="ul"
          inset={0}
          pillClassName="rounded-xl bg-sidebar-accent/50"
          pillContainerClassName="inset-y-0.5"
          data-slot="sidebar-menu"
          data-sidebar="menu"
          className={cn(
            "flex w-full min-w-0 list-none flex-col gap-1",
            className,
          )}
        >
          {children}
        </SharedLayoutBg>
      )
    }

    return (
      <ul
        {...props}
        ref={forwardedRef}
        data-slot="sidebar-menu"
        data-sidebar="menu"
        className={cn(
          "flex w-full min-w-0 list-none flex-col gap-1",
          className,
        )}
      >
        {children}
      </ul>
    )
  },
)

export const SidebarMenuItem = React.forwardRef<
  HTMLLIElement,
  React.LiHTMLAttributes<HTMLLIElement>
>(function SidebarMenuItem({ className, ...props }, forwardedRef) {
  return (
    <li
      {...props}
      ref={forwardedRef}
      data-slot="sidebar-menu-item"
      data-sidebar="menu-item"
      className={cn("group/menu-item relative list-none w-full", className)}
    />
  )
})

export interface SidebarMenuButtonProps
  extends useRender.ComponentProps<"button">,
    React.ComponentProps<"button"> {
  isActive?: boolean
  tooltip?: string | React.ComponentProps<typeof TooltipContent>
  badge?: React.ReactNode
  size?: "default" | "sm" | "lg"
}

export function SidebarMenuButton({
  render,
  children,
  isActive = false,
  size = "default",
  tooltip,
  className,
  ...props
}: SidebarMenuButtonProps) {
  const context = useSidebar()
  const panel = useSidebarPanel()
  const reduce = context.reduce

  const buttonContent = (
    <>
      {isActive && (
        <motion.span
          layoutId={context.layoutId}
          transition={reduce ? { duration: 0 } : SPRING_LAYOUT}
          className="absolute inset-0 z-0 rounded-xl bg-sidebar-accent shadow-xs"
        />
      )}
      {children}
    </>
  )

  const sizeClasses =
    size === "lg"
      ? "h-11 text-sm"
      : size === "sm"
        ? "h-8 text-xs"
        : "h-10 text-sm"

  const interactiveClassName = cn(
    "peer/menu-button group/menu-button relative flex w-full min-w-0 items-center overflow-hidden rounded-xl text-left font-medium outline-none",
    "text-sidebar-foreground/80 transition-colors hover:text-sidebar-foreground",
    "focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar active:scale-[0.98]",
    isActive && "text-sidebar-foreground font-semibold",
    sizeClasses,
    className,
  )

  const comp = useRender({
    defaultTagName: "button",
    props: mergeProps<"button">(
      {
        className: interactiveClassName,
        children: buttonContent,
        type: props.type ?? "button",
      },
      props,
    ),
    render: !tooltip ? render : <TooltipTrigger render={render} />,
    state: {
      slot: "sidebar-menu-button",
      sidebar: "menu-button",
      size,
      active: isActive,
    },
  })

  if (!tooltip) return comp

  const tooltipProps =
    typeof tooltip === "string" ? { children: tooltip } : tooltip

  return (
    <Tooltip>
      {comp}
      <TooltipContent
        side="right"
        align="center"
        hidden={!panel.collapsed || context.isMobile}
        {...tooltipProps}
      />
    </Tooltip>
  )
}

export const SidebarMenuAction = React.forwardRef<
  HTMLButtonElement,
  useRender.ComponentProps<"button"> &
    React.ComponentProps<"button"> & {
      showOnHover?: boolean
    }
>(function SidebarMenuAction(
  { className, render, showOnHover = false, ...props },
  forwardedRef,
) {
  return useRender({
    defaultTagName: "button",
    props: mergeProps<"button">(
      {
        ref: forwardedRef,
        className: cn(
          "absolute top-1.5 right-1 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-sidebar-foreground ring-sidebar-ring outline-hidden transition-transform group-data-[collapsible=icon]:hidden peer-hover/menu-button:text-sidebar-accent-foreground peer-data-[size=default]/menu-button:top-1.5 peer-data-[size=lg]/menu-button:top-2.5 peer-data-[size=sm]/menu-button:top-1 after:absolute after:-inset-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 md:after:hidden [&>svg]:size-4 [&>svg]:shrink-0",
          showOnHover &&
            "group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 peer-data-active/menu-button:text-sidebar-accent-foreground aria-expanded:opacity-100 md:opacity-0",
          className,
        ),
      },
      props,
    ),
    render,
    state: {
      slot: "sidebar-menu-action",
      sidebar: "menu-action",
    },
  })
})

export const SidebarMenuBadge = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(function SidebarMenuBadge({ className, ...props }, forwardedRef) {
  return (
    <div
      {...props}
      ref={forwardedRef}
      data-slot="sidebar-menu-badge"
      data-sidebar="menu-badge"
      className={cn(
        "pointer-events-none absolute right-1 flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-xs font-medium text-sidebar-foreground tabular-nums select-none group-data-[collapsible=icon]:hidden peer-hover/menu-button:text-sidebar-accent-foreground peer-data-[size=default]/menu-button:top-1.5 peer-data-[size=lg]/menu-button:top-2.5 peer-data-[size=sm]/menu-button:top-1 peer-data-active/menu-button:text-sidebar-accent-foreground",
        className,
      )}
    />
  )
})

export function SidebarMenuSkeleton({
  className,
  showIcon = false,
  ...props
}: React.ComponentProps<"div"> & {
  showIcon?: boolean
}) {
  const [width] = React.useState(
    () => `${Math.floor(Math.random() * 40) + 50}%`,
  )

  return (
    <div
      data-slot="sidebar-menu-skeleton"
      data-sidebar="menu-skeleton"
      className={cn("flex h-8 items-center gap-2 rounded-md px-2", className)}
      {...props}
    >
      {showIcon && (
        <Skeleton
          className="size-4 rounded-md"
          data-sidebar="menu-skeleton-icon"
        />
      )}
      <Skeleton
        className="h-4 max-w-(--skeleton-width) flex-1"
        data-sidebar="menu-skeleton-text"
        style={{ "--skeleton-width": width } as React.CSSProperties}
      />
    </div>
  )
}

export interface SidebarMenuSubProps
  extends Omit<HTMLMotionProps<"ul">, "children"> {
  open: boolean
  children?: React.ReactNode
}

export const SidebarMenuSub = React.forwardRef<
  HTMLUListElement,
  SidebarMenuSubProps
>(function SidebarMenuSub(
  { open, children, className, ...props },
  forwardedRef,
) {
  const context = useSidebar()
  const panel = useSidebarPanel()

  return (
    <AnimatePresence initial={false} mode="popLayout">
      {open && !panel.collapsed && (
        <motion.ul
          {...props}
          ref={forwardedRef}
          key="sidebar-submenu"
          variants={context.reduce ? undefined : SUBMENU_VARIANTS}
          initial={context.reduce ? false : "closed"}
          animate={context.reduce ? { opacity: 1 } : "open"}
          exit={context.reduce ? { opacity: 0 } : "closed"}
          transition={context.reduce ? { duration: 0.12 } : undefined}
          data-slot="sidebar-menu-sub"
          data-sidebar="menu-sub"
          className={cn(
            "relative mt-1 ml-5 flex min-w-0 flex-col gap-1 border-sidebar-border border-l pl-3",
            className,
          )}
        >
          {children}
        </motion.ul>
      )}
    </AnimatePresence>
  )
})

export const SidebarMenuSubItem = React.forwardRef<
  HTMLLIElement,
  HTMLMotionProps<"li">
>(function SidebarMenuSubItem({ className, ...props }, forwardedRef) {
  return (
    <motion.li
      {...props}
      ref={forwardedRef}
      variants={SUBMENU_ITEM_VARIANTS}
      data-slot="sidebar-menu-sub-item"
      data-sidebar="menu-sub-item"
      className={cn("relative min-w-0 list-none", className)}
    />
  )
})

export const SidebarMenuSubButton = React.forwardRef<
  HTMLAnchorElement,
  useRender.ComponentProps<"a"> &
    React.ComponentProps<"a"> & {
      size?: "sm" | "md"
      isActive?: boolean
    }
>(function SidebarMenuSubButton(
  { render, size = "md", isActive = false, className, ...props },
  forwardedRef,
) {
  return useRender({
    defaultTagName: "a",
    props: mergeProps<"a">(
      {
        ref: forwardedRef,
        className: cn(
          "flex h-7 min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-md px-2 text-sidebar-foreground ring-sidebar-ring outline-hidden group-data-[collapsible=icon]:hidden hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[size=md]:text-sm data-[size=sm]:text-xs data-active:bg-sidebar-accent data-active:text-sidebar-accent-foreground [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-sidebar-accent-foreground",
          className,
        ),
      },
      props,
    ),
    render,
    state: {
      slot: "sidebar-menu-sub-button",
      sidebar: "menu-sub-button",
      size,
      active: isActive,
    },
  })
})
