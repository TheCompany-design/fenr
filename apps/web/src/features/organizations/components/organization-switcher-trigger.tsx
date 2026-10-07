/**
 * Sidebar trigger for the workspace switcher.
 *
 * The active workspace's circular avatar is the whole switcher: name and
 * chevron sit beside it when the rail is expanded, and the avatar alone
 * anchors the row when the rail collapses — the sidebar tooltip then carries
 * the name. Presentation only; every piece of state arrives as a prop so this
 * stays renderable without the surrounding switcher.
 *
 * Rendered by `OrganizationSwitcher` as the dropdown's trigger element, which
 * means it must stay a single element that forwards a ref.
 */
import { ArrowDown01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  SidebarCollapsibleLabel,
  SidebarMenuButton,
} from "@workspace/ui/components/sidebar"
import { cn } from "@workspace/ui/lib/utils"
import type * as React from "react"

import type { ActiveOrganization } from "../server"
import { OrganizationAvatar } from "./organization-avatar"

export const NO_WORKSPACE_LABEL = "Select workspace"

export interface OrganizationSwitcherTriggerProps
  extends React.ComponentProps<"button"> {
  activeOrganization?: ActiveOrganization | null
  open?: boolean
}

export function OrganizationSwitcherTrigger({
  activeOrganization,
  open = false,
  className,
  children: _children,
  ...props
}: OrganizationSwitcherTriggerProps) {
  const organization = activeOrganization?.organization
  const name = organization?.name ?? NO_WORKSPACE_LABEL

  return (
    <SidebarMenuButton
      size="lg"
      tooltip={name}
      // No pill, border or plate around the row: the avatar *is* the control.
      // The only open-state cue is the popup itself, which is already
      // attached to this row — a highlight box behind the circle just reads
      // as a container nested inside the rail.
      className={cn("hover:bg-transparent", className)}
      // `AnimatedDropdown` clones its trigger with the positioning ref, an
      // onClick and the aria-haspopup/aria-expanded pair. Spreading whatever
      // it injected is what keeps the row opening the popup and anchoring it
      // to itself — swallowing those silently strands the menu at (0, 0).
      {...props}
      // Explicit, because the visible name is `aria-hidden` in the collapsed
      // rail — without this the icon-only row would have no accessible name.
      aria-label={`Current workspace: ${name}. Click to switch workspace.`}
      data-open={open ? "true" : undefined}
    >
      <div className="relative z-10 flex size-10 shrink-0 items-center justify-center">
        <OrganizationAvatar
          name={organization?.name}
          slug={organization?.slug}
          logo={organization?.logo}
          size="sm"
          shape="circle"
          className="ring-1 ring-sidebar-border/70 transition-opacity group-hover/menu-button:opacity-80"
        />
      </div>
      <SidebarCollapsibleLabel className="relative z-10 grow pl-2.5 text-sm font-semibold leading-none">
        {name}
      </SidebarCollapsibleLabel>
      <SidebarCollapsibleLabel
        className="relative z-10 flex shrink-0 items-center"
        // The chevron is decoration next to the row's own accessible name.
        aria-hidden
      >
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          size={14}
          className="text-muted-foreground"
        />
      </SidebarCollapsibleLabel>
    </SidebarMenuButton>
  )
}
