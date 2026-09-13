import {
  Add01Icon,
  Building01Icon,
  Loading03Icon,
  Sorting05Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "@tanstack/react-router"
import { AnimatedDropdown } from "@workspace/ui/components/animated-dropdown"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import { Separator } from "@workspace/ui/components/separator"
import { cn } from "@workspace/ui/lib/utils"
import * as React from "react"
import { toast } from "sonner"

import { moduleLogger } from "@/lib/logger"
import {
  invalidateOrganizationQueries,
  organizationListQueryOptions,
} from "../queries"
import type { ActiveOrganization } from "../server"
import { setActiveOrganizationFn } from "../server"
import { CreateOrganizationDialog } from "./create-organization-dialog"
import { OrganizationAvatar } from "./organization-avatar"

const log = moduleLogger("organizations")

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
  const [isOpen, setIsOpen] = React.useState(defaultOpen)
  const [isCreateOpen, setIsCreateOpen] = React.useState(false)
  const [switchingId, setSwitchingId] = React.useState<string | null>(null)

  const {
    data: organizations = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery(organizationListQueryOptions())

  React.useEffect(() => {
    if (isError) {
      log.error({ err: error }, "Failed to load organizations")
      toast.error("Failed to load organizations", {
        description: "Could not retrieve your organization list.",
      })
    }
  }, [isError, error])

  const activeId = activeOrganization?.organization.id
  const displayName =
    activeOrganization?.organization.name ?? "Select organization"

  const handleSwitch = async (orgId: string, orgName: string) => {
    if (orgId === activeId) {
      setIsOpen(false)
      return
    }

    setSwitchingId(orgId)
    try {
      await setActiveOrganizationFn({ data: { organizationId: orgId } })
      toast.success(`Switched to ${orgName}`)
      await invalidateOrganizationQueries(queryClient, orgId)
      await router.invalidate()
      setIsOpen(false)
    } catch (err) {
      log.error({ err, orgId, orgName }, "Failed to switch organization")
      toast.error("Failed to switch organization", {
        description: "Could not switch organization. Please try again.",
      })
    } finally {
      setSwitchingId(null)
    }
  }

  const trigger = (
    <button
      type="button"
      aria-label={`Current workspace: ${displayName}. Click to switch organization.`}
      className={cn(
        "flex h-9 items-center gap-2 rounded-full border border-border/60 bg-background/80 px-2.5 py-1.5 backdrop-blur-md shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground select-none",
        isOpen && "bg-accent text-accent-foreground",
        className,
      )}
    >
      <OrganizationAvatar
        name={activeOrganization?.organization.name}
        slug={activeOrganization?.organization.slug}
        logo={activeOrganization?.organization.logo}
        size="xs"
      />
      <span className="max-w-32 truncate text-xs font-medium text-foreground">
        {displayName}
      </span>
      <HugeiconsIcon
        icon={Sorting05Icon}
        size={14}
        className="text-muted-foreground shrink-0"
      />
    </button>
  )

  return (
    <>
      <AnimatedDropdown
        open={isOpen}
        onOpenChange={setIsOpen}
        trigger={trigger}
        side="bottom"
        align="start"
        sideOffset={6}
      >
        {(onClose) => (
          <div className="w-72 p-1 text-popover-foreground">
            {/* Header */}
            <div className="flex items-center justify-between px-2.5 py-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <HugeiconsIcon icon={Building01Icon} size={14} />
                <span>Organizations</span>
              </div>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {organizations.length}
              </Badge>
            </div>

            <Separator className="my-1" />

            {/* Organizations List */}
            <ScrollArea className="max-h-64 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-6 text-xs text-muted-foreground gap-2">
                  <HugeiconsIcon
                    icon={Loading03Icon}
                    size={14}
                    className="animate-spin"
                  />
                  Loading organizations…
                </div>
              ) : isError ? (
                <div className="flex flex-col items-center justify-center py-4 px-2 text-center text-xs gap-2">
                  <span className="text-destructive font-medium">
                    Failed to load organizations
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => void refetch()}
                  >
                    Retry
                  </Button>
                </div>
              ) : organizations.length === 0 ? (
                <div className="py-4 text-center text-xs text-muted-foreground">
                  No organizations found
                </div>
              ) : (
                <div className="flex flex-col gap-0.5 p-0.5">
                  {organizations.map((org) => {
                    const isActive = org.id === activeId
                    const isSwitchingThis = switchingId === org.id

                    return (
                      <button
                        key={org.id}
                        type="button"
                        onClick={() => handleSwitch(org.id, org.name)}
                        disabled={Boolean(switchingId)}
                        className={cn(
                          "flex w-full items-center justify-between gap-2.5 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                          "hover:bg-accent hover:text-accent-foreground",
                          isActive && "bg-accent/60 font-medium",
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <OrganizationAvatar
                            name={org.name}
                            slug={org.slug}
                            logo={org.logo}
                            size="sm"
                          />
                          <div className="flex flex-col min-w-0">
                            <span className="truncate text-xs font-medium text-foreground">
                              {org.name}
                            </span>
                            <span className="truncate font-mono text-[10px] text-muted-foreground">
                              fenr.app/{org.slug}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <Badge
                            variant="outline"
                            className="text-[10px] capitalize px-1 py-0 font-normal"
                          >
                            {org.role}
                          </Badge>

                          {isSwitchingThis ? (
                            <HugeiconsIcon
                              icon={Loading03Icon}
                              size={14}
                              className="animate-spin text-primary shrink-0"
                            />
                          ) : isActive ? (
                            <HugeiconsIcon
                              icon={Tick02Icon}
                              size={14}
                              className="text-primary shrink-0"
                            />
                          ) : null}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </ScrollArea>

            <Separator className="my-1" />

            {/* Footer: Create Organization Action */}
            <div className="p-0.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full justify-start text-xs font-normal gap-2 h-8"
                disabled={Boolean(switchingId)}
                onClick={() => {
                  onClose()
                  setIsCreateOpen(true)
                }}
              >
                <HugeiconsIcon icon={Add01Icon} size={14} />
                Create organization
              </Button>
            </div>
          </div>
        )}
      </AnimatedDropdown>

      {/* Create Organization Modal */}
      <CreateOrganizationDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
      />
    </>
  )
}
