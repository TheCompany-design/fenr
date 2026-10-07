/**
 * Workspace switcher — the sidebar's top control.
 *
 * Sits at the head of the sidebar: the active workspace's avatar opens a popup
 * listing every workspace the user belongs to, with "Add new workspace" below.
 * The popup body and the trigger are separate components; this file owns the
 * query, the switch transaction and the create dialog.
 *
 * Requires a `SidebarProvider`/`Sidebar` ancestor — the popup opens sideways
 * when the rail is collapsed to icons, and downwards when it is expanded.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "@tanstack/react-router"
import { AnimatedDropdown } from "@workspace/ui/components/animated-dropdown"
import {
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
} from "@workspace/ui/components/sidebar"
import * as React from "react"
import { toast } from "sonner"

import {
  invalidateOrganizationQueries,
  type OrganizationListItem,
  organizationListQueryOptions,
} from "../queries"
import type { ActiveOrganization } from "../server"
import { setActiveOrganizationFn } from "../server"
import { CreateOrganizationDialog } from "./create-organization-dialog"
import { OrganizationSwitcherMenu } from "./organization-switcher-menu"
import { OrganizationSwitcherTrigger } from "./organization-switcher-trigger"

export interface OrganizationSwitcherProps {
  activeOrganization?: ActiveOrganization | null
  className?: string
  defaultOpen?: boolean
}

export function OrganizationSwitcher({
  activeOrganization,
  className,
  defaultOpen = false,
}: OrganizationSwitcherProps) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const { state, isMobile } = useSidebar()
  const [isOpen, setIsOpen] = React.useState(defaultOpen)
  const [isCreateOpen, setIsCreateOpen] = React.useState(false)
  const [switchingId, setSwitchingId] = React.useState<string | null>(null)

  const {
    data: organizations = [],
    isLoading,
    isError,
    refetch,
  } = useQuery(organizationListQueryOptions())

  React.useEffect(() => {
    if (isError) {
      toast.error("Failed to load workspaces", {
        description: "Could not retrieve your workspace list.",
      })
    }
  }, [isError])

  // Mobile renders the sidebar as a full-width sheet, so it never collapses —
  // matching the nav items' rule keeps the popup below the row either way.
  const collapsed = state === "collapsed" && !isMobile

  const handleSwitch = async (organization: OrganizationListItem) => {
    if (organization.id === activeOrganization?.organization.id) {
      setIsOpen(false)
      return
    }

    setSwitchingId(organization.id)
    try {
      await setActiveOrganizationFn({
        data: { organizationId: organization.id },
      })
      toast.success(`Switched to ${organization.name}`)
      await invalidateOrganizationQueries(queryClient, organization.id)
      await router.invalidate()
      setIsOpen(false)
    } catch {
      toast.error("Failed to switch workspace", {
        description: "Could not switch workspace. Please try again.",
      })
    } finally {
      setSwitchingId(null)
    }
  }

  return (
    <>
      <SidebarMenu enableHoverGlider={false}>
        <SidebarMenuItem>
          <AnimatedDropdown
            open={isOpen}
            onOpenChange={setIsOpen}
            trigger={
              <OrganizationSwitcherTrigger
                activeOrganization={activeOrganization}
                open={isOpen}
                className={className}
              />
            }
            side={collapsed ? "right" : "bottom"}
            align="start"
            sideOffset={collapsed ? 10 : 6}
            // The dropdown ships a translucent popover surface. Two overrides:
            // the surface must be opaque, and it must read as a layer above
            // the sidebar — `--popover` and `--sidebar` resolve to the same
            // lightness in this theme, so without a ring the card vanishes
            // into the rail behind it.
            className="border-border bg-popover ring-1 ring-foreground/10 backdrop-blur-none"
          >
            {(onClose) => (
              <OrganizationSwitcherMenu
                organizations={organizations}
                activeOrganizationId={activeOrganization?.organization.id}
                switchingId={switchingId}
                isLoading={isLoading}
                isError={isError}
                onRetry={() => void refetch()}
                onSelect={(organization) => void handleSwitch(organization)}
                onCreate={() => {
                  onClose()
                  setIsCreateOpen(true)
                }}
              />
            )}
          </AnimatedDropdown>
        </SidebarMenuItem>
      </SidebarMenu>

      <CreateOrganizationDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
      />
    </>
  )
}
