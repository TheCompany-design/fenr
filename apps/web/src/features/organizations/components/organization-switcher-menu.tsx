/**
 * Body of the workspace switcher popup.
 *
 * Presentation only: the parent owns the query, the switching state and the
 * create dialog. Every row is a `menuitemradio` tagged `data-menu-item` so the
 * dropdown's arrow-key navigation can reach it.
 *
 * Rows are deliberately single-line — avatar, name, active marker. The role
 * and slug that used to sit under each name moved out of this list; the popup
 * is a picker, not a directory. The active workspace is marked by the ringed
 * tick alone, never a filled row: the shared glide pill owns that surface, and
 * a second persistent highlight underneath it stops reading as hover.
 */
import {
  Add01Icon,
  Loading03Icon,
  Tick01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  DropdownGlidePill,
  useDropdownGlider,
} from "@workspace/ui/components/dropdown-glide"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import { Separator } from "@workspace/ui/components/separator"
import { cn } from "@workspace/ui/lib/utils"

import type { OrganizationListItem } from "../queries"
import { OrganizationAvatar } from "./organization-avatar"

export interface OrganizationSwitcherMenuProps {
  organizations: readonly OrganizationListItem[]
  activeOrganizationId?: string
  /** Id of the organization whose switch is in flight, if any. */
  switchingId: string | null
  isLoading: boolean
  isError: boolean
  onRetry: () => void
  onSelect: (organization: OrganizationListItem) => void
  onCreate: () => void
}

/** The ringed tick that marks the workspace currently in use. */
function ActiveMarker() {
  return (
    <span
      data-testid="workspace-active-marker"
      className="flex size-5 shrink-0 items-center justify-center rounded-full border border-foreground/25 text-foreground"
    >
      <HugeiconsIcon icon={Tick01Icon} size={10} strokeWidth={2.5} />
    </span>
  )
}

function MenuItem({
  children,
  className,
  disabled,
  onClick,
  testId,
  ...props
}: {
  children: React.ReactNode
  className?: string
  disabled?: boolean
  onClick?: () => void
  testId?: string
} & React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      data-menu-item="true"
      data-testid={testId}
      disabled={disabled}
      onClick={onClick}
      // `isolate` keeps the pill behind this row's content without letting it
      // drop behind the popup surface or the page.
      className={cn(
        "relative isolate flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
        "text-popover-foreground hover:text-accent-foreground",
        "focus-visible:outline-none",
        "disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

function MenuMessage({
  children,
  action,
}: {
  children: React.ReactNode
  action?: { label: string; onClick: () => void }
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-2 py-4 text-center text-xs text-muted-foreground">
      <span>{children}</span>
      {action ? (
        <button
          type="button"
          onClick={action.onClick}
          className="rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent"
        >
          {action.label}
        </button>
      ) : null}
    </div>
  )
}

export function OrganizationSwitcherMenu({
  organizations,
  activeOrganizationId,
  switchingId,
  isLoading,
  isError,
  onRetry,
  onSelect,
  onCreate,
}: OrganizationSwitcherMenuProps) {
  // A switch in flight freezes the whole list: a second switch would race the
  // first and leave the session pointing at whichever request landed last.
  const switching = Boolean(switchingId)
  const glide = useDropdownGlider()

  return (
    <div role="menu" aria-label="Workspaces" className="flex flex-col">
      <p className="px-2 pb-1.5 pt-2 text-[13px] font-semibold text-muted-foreground">
        Workspaces
      </p>

      <ScrollArea className="max-h-64 px-1.5">
        {isLoading ? (
          <MenuMessage>Loading workspaces…</MenuMessage>
        ) : isError ? (
          <MenuMessage action={{ label: "Retry", onClick: onRetry }}>
            Could not load your workspaces.
          </MenuMessage>
        ) : organizations.length === 0 ? (
          <MenuMessage>You are not a member of any workspace yet.</MenuMessage>
        ) : (
          <div className="flex flex-col">
            {organizations.map((organization) => {
              const rowId = `workspace:${organization.id}`
              const isActive = organization.id === activeOrganizationId
              const isSwitchingThis = switchingId === organization.id

              return (
                <MenuItem
                  key={organization.id}
                  role="menuitemradio"
                  aria-checked={isActive}
                  disabled={switching}
                  onClick={() => onSelect(organization)}
                  testId={`workspace-option-${organization.id}`}
                  {...glide.rowProps(rowId)}
                >
                  <DropdownGlidePill
                    layoutId={glide.layoutId}
                    active={glide.activeId === rowId}
                  />
                  <OrganizationAvatar
                    name={organization.name}
                    slug={organization.slug}
                    logo={organization.logo}
                    size="sm"
                    shape="circle"
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {organization.name}
                  </span>
                  {isSwitchingThis ? (
                    <HugeiconsIcon
                      icon={Loading03Icon}
                      size={14}
                      className="shrink-0 animate-spin text-muted-foreground"
                    />
                  ) : isActive ? (
                    <ActiveMarker />
                  ) : null}
                </MenuItem>
              )
            })}
          </div>
        )}
      </ScrollArea>

      <Separator className="my-1.5" />

      <MenuItem
        role="menuitem"
        disabled={switching}
        onClick={onCreate}
        testId="workspace-add"
        className="font-medium"
        {...glide.rowProps("workspace:add")}
      >
        <DropdownGlidePill
          layoutId={glide.layoutId}
          active={glide.activeId === "workspace:add"}
        />
        <HugeiconsIcon icon={Add01Icon} size={16} className="shrink-0" />
        Add new workspace
      </MenuItem>
    </div>
  )
}
