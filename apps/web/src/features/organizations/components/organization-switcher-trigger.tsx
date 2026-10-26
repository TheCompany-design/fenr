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
      className={cn("hover:bg-transparent", className)}
      {...props}
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
