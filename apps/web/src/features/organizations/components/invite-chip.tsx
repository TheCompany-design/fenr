import {
  ArrowDown01Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  Loading03Icon,
  RefreshIcon,
  SparklesIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { cn } from "@workspace/ui/lib/utils"
import * as React from "react"

import type { OrganizationRole } from "@/lib/schemas/organizations"

export interface QueuedInvite {
  id: string
  email: string
  role: OrganizationRole
  status: "pending" | "sending" | "success" | "error"
  error?: string
}

export const ROLE_DESCRIPTIONS: Record<string, string> = {
  admin: "Manage workspace and people.",
  member: "Create and edit projects.",
  viewer: "Read-only access.",
  owner: "Full workspace control.",
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const isValidEmail = (email: string) => EMAIL_RE.test(email.trim())

export const initials = (email: string) => {
  const namePart = email.trim().split("@")[0] ?? ""
  return namePart.slice(0, 2).toUpperCase() || "??"
}

export interface ChipPillProps {
  invite: QueuedInvite
  allowedRoles: OrganizationRole[]
  isSubmitting: boolean
  isAutoJoin: boolean
  defaultOpenRole?: boolean
  onRemove: () => void
  onRoleChange: (role: OrganizationRole) => void
  onRetry?: () => void
}

export function ChipPill({
  invite,
  allowedRoles,
  isSubmitting,
  isAutoJoin,
  defaultOpenRole = false,
  onRemove,
  onRoleChange,
  onRetry,
}: ChipPillProps) {
  const valid = isValidEmail(invite.email)
  const isFailed = invite.status === "error"
  const autoJoinActive = valid && isAutoJoin
  const [roleOpen, setRoleOpen] = React.useState(defaultOpenRole)

  return (
    <div
      data-testid={`chip-${invite.email}`}
      className={cn(
        "group inline-flex h-7 items-center gap-1.5 rounded-full border pl-1 pr-1 text-xs transition-colors select-none",
        isFailed
          ? "border-destructive/40 bg-destructive/5 text-destructive"
          : autoJoinActive
            ? "border-border bg-muted text-foreground"
            : !valid
              ? "border-border bg-secondary text-secondary-foreground"
              : "border-border bg-foreground/[0.04] text-foreground",
      )}
    >
      {/* 2-char initials pill */}
      <span
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full font-mono text-[9px] uppercase",
          autoJoinActive
            ? "bg-muted text-foreground font-semibold"
            : "bg-foreground/[0.08] text-muted-foreground font-medium",
        )}
        aria-hidden="true"
      >
        {initials(invite.email)}
      </span>

      {/* Email text */}
      <span className="truncate max-w-[150px] sm:max-w-[220px] font-mono text-xs">
        {invite.email}
      </span>

      {/* Auto-join badge or invalid tag or inline role dropdown */}
      {autoJoinActive ? (
        <span
          data-testid={`autojoin-badge-${invite.email}`}
          className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 font-mono text-[9px] text-foreground font-medium uppercase tracking-[0.18em]"
        >
          <HugeiconsIcon icon={SparklesIcon} size={10} />
          Auto-join
        </span>
      ) : !valid ? (
        <span className="font-mono text-[9px] text-destructive uppercase tracking-[0.2em] font-medium">
          Invalid
        </span>
      ) : (
        <DropdownMenu open={roleOpen} onOpenChange={setRoleOpen}>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                disabled={isSubmitting || invite.status === "sending"}
                aria-label={`Change role for ${invite.email}`}
                data-testid={`role-trigger-${invite.email}`}
                className="flex h-5 items-center gap-0.5 rounded-full px-1.5 font-mono text-[10px] text-muted-foreground uppercase tracking-[0.18em] transition-colors hover:bg-foreground/[0.06] hover:text-foreground disabled:pointer-events-none cursor-pointer"
              >
                <span>{invite.role}</span>
                <HugeiconsIcon icon={ArrowDown01Icon} size={10} />
              </button>
            }
          />
          <DropdownMenuContent align="start" className="w-52 p-1">
            {allowedRoles.map((r) => {
              const active = r === invite.role
              return (
                <DropdownMenuItem
                  key={r}
                  onClick={() => onRoleChange(r)}
                  data-testid={`role-option-${invite.email}-${r}`}
                  className="flex items-start gap-2 py-1.5 cursor-pointer capitalize"
                >
                  <HugeiconsIcon
                    icon={CheckmarkCircle02Icon}
                    size={14}
                    className={cn(
                      "mt-0.5 shrink-0",
                      active ? "opacity-100 text-primary" : "opacity-0",
                    )}
                  />
                  <div className="flex flex-col">
                    <span className="capitalize font-medium text-xs">{r}</span>
                    <span className="text-muted-foreground text-[11px] leading-tight normal-case">
                      {ROLE_DESCRIPTIONS[r] ?? `${r} role`}
                    </span>
                  </div>
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Sending spinner */}
      {invite.status === "sending" && (
        <HugeiconsIcon
          icon={Loading03Icon}
          size={12}
          className="animate-spin text-primary shrink-0"
        />
      )}

      {/* Success check */}
      {invite.status === "success" && (
        <HugeiconsIcon
          icon={CheckmarkCircle02Icon}
          size={12}
          className="text-foreground shrink-0"
        />
      )}

      {/* Error / Retry button */}
      {invite.status === "error" && (
        <button
          type="button"
          onClick={onRetry}
          disabled={isSubmitting}
          aria-label={`Retry invitation to ${invite.email}`}
          title={`Retry: ${invite.error ?? "Failed to send"}`}
          className="flex items-center text-destructive hover:opacity-80 shrink-0 cursor-pointer disabled:pointer-events-none"
        >
          <HugeiconsIcon icon={RefreshIcon} size={12} />
        </button>
      )}

      {/* Remove button */}
      <button
        type="button"
        onClick={onRemove}
        disabled={isSubmitting || invite.status === "sending"}
        aria-label={`Remove ${invite.email}`}
        data-testid={`remove-chip-${invite.email}`}
        className="flex size-5 items-center justify-center rounded-full opacity-50 hover:bg-foreground/[0.08] hover:opacity-100 transition-all disabled:pointer-events-none cursor-pointer"
      >
        <HugeiconsIcon icon={Cancel01Icon} size={11} />
      </button>
    </div>
  )
}
