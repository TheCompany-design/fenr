import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import {
  Cancel01Icon,
  SidebarLeft01Icon,
  SidebarRight01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@workspace/ui/components/button"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { useIsMobile } from "@workspace/ui/hooks/use-mobile"
import {
  EASE_DRAWER,
  REDUCED_TRANSITION,
  SIDEBAR_MORPH_TRANSITION,
} from "@workspace/ui/lib/ease"
import { cn } from "@workspace/ui/lib/utils"
import { m, useReducedMotion } from "motion/react"
import * as React from "react"
import { createPortal } from "react-dom"
import { useSecondarySidebarStore } from "@/lib/stores/secondary-sidebar.store"

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",")

export interface SecondarySidebarSlotProps {
  readonly className?: string
  readonly width?: string
}

export function SecondarySidebarSlot({
  className,
  width = "17.5rem",
}: SecondarySidebarSlotProps) {
  const isMobile = useIsMobile()
  const reduce = useReducedMotion() ?? false
  const isOpen = useSecondarySidebarStore((s) => s.isOpen)
  const isOpenMobile = useSecondarySidebarStore((s) => s.isOpenMobile)
  const hasContent = useSecondarySidebarStore((s) => s.hasContent)
  const publishTarget = useSecondarySidebarStore((s) => s.publishTarget)
  const closeMobile = useSecondarySidebarStore((s) => s.closeMobile)

  const [desktopTarget, setDesktopTarget] =
    React.useState<HTMLDivElement | null>(null)
  const [mobileTarget, setMobileTarget] = React.useState<HTMLDivElement | null>(
    null,
  )
  const mobilePanelRef = React.useRef<HTMLDivElement | null>(null)

  // Attach target node to store depending on screen mode
  React.useEffect(() => {
    if (isMobile) {
      publishTarget(mobileTarget)
    } else {
      publishTarget(desktopTarget)
    }
  }, [isMobile, desktopTarget, mobileTarget, publishTarget])

  // Handle focus trap and escape key for mobile drawer
  React.useEffect(() => {
    if (!isMobile || !isOpenMobile) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        closeMobile()
        return
      }

      if (event.key === "Tab") {
        const panel = mobilePanelRef.current
        if (!panel) return
        const focusables = Array.from(
          panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
        )
        if (focusables.length === 0) {
          event.preventDefault()
          panel.focus()
          return
        }
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last?.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first?.focus()
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isMobile, isOpenMobile, closeMobile])

  // If no content is published to the secondary sidebar, render nothing
  if (!hasContent) {
    return null
  }

  const effectiveWidth = isOpen ? width : "0px"

  return (
    <>
      {/* Desktop collapsible panel */}
      <m.aside
        aria-label="Secondary navigation"
        data-slot="secondary-sidebar"
        data-state={isOpen ? "expanded" : "collapsed"}
        initial={false}
        animate={{
          width: effectiveWidth,
          opacity: isOpen ? 1 : 0,
        }}
        transition={reduce ? { duration: 0 } : SIDEBAR_MORPH_TRANSITION}
        className={cn(
          "sticky top-0 z-20 hidden h-svh shrink-0 flex-col overflow-hidden md:flex",
          !isOpen && "pointer-events-none",
          className,
        )}
      >
        <div className="relative flex size-full flex-col py-2 pr-2 pl-0">
          <div className="flex size-full flex-col overflow-hidden rounded-2xl border border-border bg-sidebar/95 text-sidebar-foreground shadow-xs backdrop-blur-md">
            <div
              ref={setDesktopTarget}
              data-slot="secondary-sidebar-portal-root"
              className="flex size-full flex-col overflow-hidden"
            />
          </div>
        </div>
      </m.aside>

      {/* Mobile drawer (sheet overlay) */}
      {isMobile &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className={cn(
              "fixed inset-0 z-50 md:hidden",
              isOpenMobile ? "pointer-events-auto" : "pointer-events-none",
            )}
          >
            {/* Backdrop */}
            <m.button
              type="button"
              tabIndex={isOpenMobile ? 0 : -1}
              aria-label="Close secondary sidebar"
              initial={false}
              animate={{ opacity: isOpenMobile ? 1 : 0 }}
              transition={
                reduce
                  ? REDUCED_TRANSITION
                  : { duration: 0.28, ease: EASE_DRAWER }
              }
              onClick={closeMobile}
              className={cn(
                "fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity",
                !isOpenMobile && "pointer-events-none opacity-0",
              )}
            />

            {/* Panel */}
            <m.div
              ref={mobilePanelRef}
              role="dialog"
              aria-modal="true"
              aria-label="Secondary navigation drawer"
              tabIndex={-1}
              data-state={isOpenMobile ? "open" : "closed"}
              initial={false}
              animate={{
                x: isOpenMobile ? "0%" : "-100%",
                opacity: isOpenMobile ? 1 : 0,
              }}
              transition={
                reduce
                  ? REDUCED_TRANSITION
                  : { duration: 0.32, ease: EASE_DRAWER }
              }
              className={cn(
                "fixed inset-y-0 left-0 z-50 flex h-dvh w-[19rem] max-w-[85vw] flex-col overflow-hidden border-r border-border bg-sidebar text-sidebar-foreground shadow-2xl",
                !isOpenMobile && "pointer-events-none",
              )}
            >
              <div
                ref={setMobileTarget}
                data-slot="secondary-sidebar-mobile-portal-root"
                className="flex size-full flex-col overflow-hidden"
              />
            </m.div>
          </div>,
          document.body,
        )}
    </>
  )
}

export interface SecondarySidebarPortalProps {
  readonly children: React.ReactNode
}

/**
 * Portals children into the secondary sidebar slot and coordinates
 * lifecycle registration with the store.
 */
export function SecondarySidebarPortal({
  children,
}: SecondarySidebarPortalProps) {
  const target = useSecondarySidebarStore((s) => s.target)
  const setHasContent = useSecondarySidebarStore((s) => s.setHasContent)

  React.useEffect(() => {
    setHasContent(true)
    return () => {
      setHasContent(false)
    }
  }, [setHasContent])

  if (!target) {
    return null
  }

  return createPortal(children, target)
}

export interface SecondarySidebarTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

export const SecondarySidebarTrigger = React.forwardRef<
  HTMLButtonElement,
  SecondarySidebarTriggerProps
>(function SecondarySidebarTrigger(
  { className, onClick, ...props },
  forwardedRef,
) {
  const isMobile = useIsMobile()
  const hasContent = useSecondarySidebarStore((s) => s.hasContent)
  const isOpen = useSecondarySidebarStore((s) => s.isOpen)
  const isOpenMobile = useSecondarySidebarStore((s) => s.isOpenMobile)
  const toggle = useSecondarySidebarStore((s) => s.toggle)
  const toggleMobile = useSecondarySidebarStore((s) => s.toggleMobile)

  if (!hasContent) {
    return null
  }

  const expanded = isMobile ? isOpenMobile : isOpen
  const label = expanded
    ? "Collapse secondary sidebar"
    : "Expand secondary sidebar"

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            {...props}
            ref={forwardedRef}
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            aria-expanded={expanded}
            onClick={(event) => {
              onClick?.(event)
              if (!event.defaultPrevented) {
                if (isMobile) toggleMobile()
                else toggle()
              }
            }}
            className={cn("size-9 rounded-full", className)}
          >
            <HugeiconsIcon
              icon={expanded ? SidebarLeft01Icon : SidebarRight01Icon}
              size={18}
            />
            <span className="sr-only">{label}</span>
          </Button>
        }
      />
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  )
})

export interface SecondarySidebarHeaderProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  readonly title: React.ReactNode
  readonly badge?: React.ReactNode
  readonly actions?: React.ReactNode
  readonly showCollapseButton?: boolean
}

export function SecondarySidebarHeader({
  title,
  badge,
  actions,
  showCollapseButton = true,
  className,
  ...props
}: SecondarySidebarHeaderProps) {
  const isMobile = useIsMobile()
  const toggle = useSecondarySidebarStore((s) => s.toggle)
  const closeMobile = useSecondarySidebarStore((s) => s.closeMobile)

  return (
    <div
      data-slot="secondary-sidebar-header"
      className={cn(
        "flex h-13 shrink-0 items-center justify-between gap-2 border-b border-sidebar-border px-3.5 py-2",
        className,
      )}
      {...props}
    >
      <div className="flex min-w-0 items-center gap-2">
        <h2 className="truncate text-sm font-semibold text-sidebar-foreground">
          {title}
        </h2>
        {badge}
      </div>

      <div className="flex items-center gap-1">
        {actions}
        {showCollapseButton && (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Collapse panel"
            onClick={() => {
              if (isMobile) closeMobile()
              else toggle()
            }}
            className="size-7 rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <HugeiconsIcon
              icon={isMobile ? Cancel01Icon : SidebarLeft01Icon}
              size={15}
            />
            <span className="sr-only">Close panel</span>
          </Button>
        )}
      </div>
    </div>
  )
}

export function SecondarySidebarBody({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="secondary-sidebar-body"
      className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", className)}
      {...props}
    >
      <ScrollArea className="size-full flex-1">{children}</ScrollArea>
    </div>
  )
}

export function SecondarySidebarFooter({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <footer
      data-slot="secondary-sidebar-footer"
      className={cn(
        "flex shrink-0 items-center justify-between border-t border-sidebar-border/70 p-2.5",
        className,
      )}
      {...props}
    >
      {children}
    </footer>
  )
}

export function SecondarySidebarRow({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="secondary-sidebar-row"
      className={cn(
        "group/secondary-item relative flex items-center",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export interface SecondarySidebarItemProps
  extends useRender.ComponentProps<"button">,
    React.ButtonHTMLAttributes<HTMLButtonElement> {
  readonly isActive?: boolean
  readonly icon?: React.ReactNode
  readonly label: React.ReactNode
  readonly badge?: React.ReactNode
}

export function SecondarySidebarItem({
  isActive = false,
  icon,
  label,
  badge,
  className,
  render,
  ...props
}: SecondarySidebarItemProps) {
  const defaultChildren = (
    <>
      {icon && (
        <span className="flex size-4 shrink-0 items-center justify-center text-sidebar-foreground/70">
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate text-left">{label}</span>
      {badge && <span className="shrink-0">{badge}</span>}
    </>
  )

  return useRender({
    defaultTagName: "button",
    props: mergeProps<"button">(
      {
        type: "button",
        className: cn(
          "group/item relative flex h-9 w-full min-w-0 items-center gap-2 rounded-xl px-2.5 text-xs font-medium text-sidebar-foreground/80 transition-colors",
          "hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
          "focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-hidden",
          isActive &&
            "bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-xs",
          className,
        ),
        children: defaultChildren,
      },
      props,
    ),
    render,
    state: {
      slot: "secondary-sidebar-item",
      active: isActive,
    },
  })
}

export interface SecondarySidebarItemActionProps
  extends useRender.ComponentProps<"button">,
    React.ButtonHTMLAttributes<HTMLButtonElement> {
  readonly showOnHover?: boolean
}

export function SecondarySidebarItemAction({
  className,
  render,
  showOnHover = true,
  ...props
}: SecondarySidebarItemActionProps) {
  return useRender({
    defaultTagName: "button",
    props: mergeProps<"button">(
      {
        type: "button",
        className: cn(
          "absolute right-1 flex size-7 items-center justify-center rounded-lg text-sidebar-foreground/70 transition-colors outline-hidden hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring",
          showOnHover &&
            "opacity-0 group-hover/secondary-item:opacity-100 group-focus-within/secondary-item:opacity-100 data-[state=open]:opacity-100",
          className,
        ),
      },
      props,
    ),
    render,
    state: {
      slot: "secondary-sidebar-item-action",
    },
  })
}

export function SecondarySidebarGroup({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="secondary-sidebar-group"
      className={cn("flex flex-col gap-1 p-2", className)}
      {...props}
    >
      {children}
    </div>
  )
}

export function SecondarySidebarGroupLabel({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      data-slot="secondary-sidebar-group-label"
      className={cn(
        "px-2.5 pt-2 pb-1 text-[11px] font-medium tracking-wider text-muted-foreground uppercase select-none",
        className,
      )}
      {...props}
    >
      {children}
    </h3>
  )
}
