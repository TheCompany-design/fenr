import {
  AlertCircleIcon,
  Cancel01Icon,
  CrownIcon,
  Delete02Icon,
  Loading03Icon,
  Mail01Icon,
  MoreHorizontalIcon,
  Shield01Icon,
  UserGroupIcon,
  UserIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "@tanstack/react-router"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { cn } from "@workspace/ui/lib/utils"
import * as React from "react"
import { toast } from "sonner"

import { useConfirmStore } from "@/components/feedback/confirm.store"
import { moduleLogger } from "@/lib/logger"
import {
  invalidateOrganizationQueries,
  organizationInvitationsQueryOptions,
  organizationMembersQueryOptions,
} from "../queries"
import type { OrganizationRole } from "../schemas"
import {
  cancelInvitationFn,
  removeMemberFn,
  updateMemberRoleFn,
} from "../server"

const log = moduleLogger("organizations")

const TONES = [
  "bg-muted text-foreground border-border",
  "bg-secondary text-secondary-foreground border-border",
  "bg-accent text-accent-foreground border-border",
  "bg-muted text-muted-foreground border-border",
  "bg-secondary text-secondary-foreground border-border",
  "bg-accent text-accent-foreground border-border",
] as const

export function getMemberTone(key: string): string {
  let hash = 0
  for (let i = 0; i < key.length; i++) {
    hash = (hash << 5) - hash + key.charCodeAt(i)
    hash |= 0
  }
  const index = Math.abs(hash) % TONES.length
  return TONES[index]
}

export function getMemberInitials(
  name?: string | null,
  email?: string | null,
): string {
  const trimmedName = name?.trim()
  if (trimmedName) {
    const parts = trimmedName.split(/\s+/)
    if (parts.length >= 2) {
      return (
        (parts[0][0] || "") + (parts[parts.length - 1][0] || "")
      ).toUpperCase()
    }
    return trimmedName.slice(0, 2).toUpperCase()
  }
  const trimmedEmail = email?.trim()
  if (trimmedEmail) {
    return trimmedEmail.slice(0, 2).toUpperCase()
  }
  return "??"
}

export interface OrganizationMembersProps {
  organizationId: string
  currentUserId: string
  currentUserRole: OrganizationRole
  className?: string
}

export function OrganizationMembers({
  organizationId,
  currentUserId,
  currentUserRole,
  className,
}: OrganizationMembersProps) {
  const router = useRouter({ warn: false })
  const queryClient = useQueryClient()
  const openConfirm = useConfirmStore((state) => state.openConfirm)

  const isOwnerOrAdmin =
    currentUserRole === "owner" || currentUserRole === "admin"
  const isOwner = currentUserRole === "owner"

  // Queries
  const {
    data: membersData,
    isLoading: isLoadingMembers,
    error: membersError,
  } = useQuery(organizationMembersQueryOptions(organizationId))

  const members = React.useMemo(
    () => membersData?.members ?? [],
    [membersData?.members],
  )

  const {
    data: invitations = [],
    isLoading: isLoadingInvitations,
    error: invitationsError,
  } = useQuery({
    ...organizationInvitationsQueryOptions(organizationId),
    enabled: isOwnerOrAdmin,
  })

  // Track pending actions per member/invitation id for spinners independently
  const [loadingActionIds, setLoadingActionIds] = React.useState<Set<string>>(
    () => new Set(),
  )
  const actionLocksRef = React.useRef(new Set<string>())

  const addLoadingId = React.useCallback((id: string) => {
    setLoadingActionIds((prev) => new Set(prev).add(id))
  }, [])

  const removeLoadingId = React.useCallback((id: string) => {
    setLoadingActionIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }, [])

  const acquireAction = React.useCallback(
    (id: string) => {
      if (actionLocksRef.current.has(id)) return false
      actionLocksRef.current.add(id)
      addLoadingId(id)
      return true
    },
    [addLoadingId],
  )

  const releaseAction = React.useCallback(
    (id: string) => {
      actionLocksRef.current.delete(id)
      removeLoadingId(id)
    },
    [removeLoadingId],
  )

  // Count active owners
  const ownerCount = React.useMemo(
    () => members.filter((m) => m.role === "owner").length,
    [members],
  )

  const handleUpdateRole = async (
    memberId: string,
    newRole: OrganizationRole,
  ) => {
    if (!acquireAction(memberId)) return
    try {
      await updateMemberRoleFn({
        data: {
          organizationId,
          memberId,
          role: newRole,
        },
      })
      toast.success("Member role updated")
      try {
        await invalidateOrganizationQueries(queryClient, organizationId)
        await router.invalidate()
      } catch (refreshErr) {
        log.warn(
          { err: refreshErr, memberId, newRole, organizationId },
          "Member role updated but refresh failed",
        )
        toast.warning("Role updated", {
          description: "The change was saved. Refresh the page to see it.",
        })
      }
    } catch (err) {
      log.error(
        { err, memberId, newRole, organizationId },
        "Failed to update member role",
      )
      toast.error("Failed to update role", {
        description:
          err instanceof Error
            ? err.message
            : "Could not update member role. Please try again.",
      })
    } finally {
      releaseAction(memberId)
    }
  }

  const handleRemoveMember = async (
    memberId: string,
    memberName: string,
    isSelf: boolean,
  ) => {
    if (!acquireAction(memberId)) return

    try {
      const confirmed = await openConfirm({
        title: isSelf ? "Leave organization?" : `Remove ${memberName}?`,
        description: isSelf
          ? "You will lose access to all resources in this organization until re-invited."
          : `Are you sure you want to remove ${memberName} from this organization?`,
        confirmText: isSelf ? "Leave" : "Remove",
        variant: "destructive",
      })

      if (!confirmed) return

      await removeMemberFn({
        data: {
          organizationId,
          memberId,
        },
      })
      toast.success(isSelf ? "You left the organization" : "Member removed")
      try {
        await invalidateOrganizationQueries(queryClient, organizationId)
      } catch (refreshErr) {
        log.warn(
          { err: refreshErr, memberId, organizationId },
          "Member removed but refresh failed",
        )
      }
      if (isSelf) {
        try {
          await router.navigate({ to: "/", replace: true })
          await router.invalidate()
        } catch (navigationErr) {
          log.warn(
            { err: navigationErr, memberId, organizationId },
            "Member removed but navigation failed",
          )
          toast.warning("You left the organization", {
            description: "Refresh the page to continue.",
          })
        }
      }
    } catch (err) {
      log.error({ err, memberId, organizationId }, "Failed to remove member")
      toast.error("Failed to remove member", {
        description:
          err instanceof Error
            ? err.message
            : "Could not remove member. Please try again.",
      })
    } finally {
      releaseAction(memberId)
    }
  }

  const handleCancelInvitation = async (
    invitationId: string,
    email: string,
  ) => {
    if (!acquireAction(invitationId)) return
    try {
      const confirmed = await openConfirm({
        title: "Revoke invitation?",
        description: `Revoke the pending invitation for ${email}? They will no longer be able to use the invitation link.`,
        confirmText: "Revoke",
        variant: "destructive",
      })

      if (!confirmed) return

      await cancelInvitationFn({
        data: {
          organizationId,
          invitationId,
        },
      })
      toast.success("Invitation revoked")
      try {
        await invalidateOrganizationQueries(queryClient, organizationId)
      } catch (refreshErr) {
        log.warn(
          { err: refreshErr, invitationId, organizationId },
          "Invitation revoked but refresh failed",
        )
        toast.warning("Invitation revoked", {
          description: "The change was saved. Refresh the page to see it.",
        })
      }
    } catch (err) {
      log.error(
        { err, invitationId, organizationId },
        "Failed to cancel invitation",
      )
      toast.error("Failed to cancel invitation", {
        description:
          err instanceof Error
            ? err.message
            : "Could not revoke invitation. Please try again.",
      })
    } finally {
      releaseAction(invitationId)
    }
  }

  if (isLoadingMembers) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm gap-2">
        <HugeiconsIcon
          icon={Loading03Icon}
          size={18}
          className="animate-spin"
        />
        Loading organization members…
      </div>
    )
  }

  if (membersError) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-destructive text-sm gap-2">
        <HugeiconsIcon icon={AlertCircleIcon} size={24} />
        <p>Failed to load organization members.</p>
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col gap-8", className)}>
      {/* Active Members Section */}
      <section className="flex flex-col gap-3">
        <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <h3 className="font-heading text-lg font-medium flex items-center gap-2">
              <HugeiconsIcon icon={UserGroupIcon} size={18} />
              Members ({members.length})
            </h3>
            <p className="text-xs text-muted-foreground">
              {members.length} {members.length === 1 ? "person" : "people"}
              {isOwnerOrAdmin
                ? ` · ${invitations.length} pending invite${invitations.length === 1 ? "" : "s"}`
                : ""}
            </p>
          </div>
        </header>

        <div className="rounded-xl border border-border/80 bg-card overflow-hidden shadow-xs">
          <ScrollArea className="w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="ps-4 min-w-[220px]">Member</TableHead>
                  <TableHead className="min-w-[140px]">Role</TableHead>
                  <TableHead className="min-w-[120px]">Joined</TableHead>
                  <TableHead className="pe-4 w-[70px] text-right">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => {
                  const isCurrentUser = member.userId === currentUserId
                  const isMemberOwner = member.role === "owner"
                  const isSoleOwner = isMemberOwner && ownerCount <= 1
                  const isBusy = loadingActionIds.has(member.id)
                  const tone = getMemberTone(member.user.email || member.userId)
                  const initials = getMemberInitials(
                    member.user.name,
                    member.user.email,
                  )

                  // Can current user manage this member?
                  // Owners can manage anyone (except demoting sole owner).
                  // Admins can only manage regular members.
                  const canChangeRole =
                    !isSoleOwner &&
                    ((isOwner && !isCurrentUser) ||
                      (currentUserRole === "admin" &&
                        member.role === "member" &&
                        !isCurrentUser))

                  const canRemove =
                    !isSoleOwner &&
                    (isOwner ||
                      (currentUserRole === "admin" &&
                        member.role === "member") ||
                      isCurrentUser)

                  return (
                    <TableRow key={member.id}>
                      <TableCell className="ps-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "size-8 rounded-full border flex items-center justify-center font-mono text-[11px] font-semibold shrink-0 select-none",
                              tone,
                            )}
                          >
                            {member.user.image ? (
                              <img
                                src={member.user.image}
                                alt={member.user.name}
                                className="size-full rounded-full object-cover"
                              />
                            ) : (
                              initials
                            )}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm font-medium truncate flex items-center gap-1.5 text-foreground">
                              {member.user.name}
                              {isCurrentUser && (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] px-1.5 py-0 font-normal"
                                >
                                  You
                                </Badge>
                              )}
                            </span>
                            <span className="text-xs text-muted-foreground truncate font-mono">
                              {member.user.email}
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        {canChangeRole ? (
                          <Select
                            value={member.role}
                            onValueChange={(value) => {
                              if (value && value !== member.role) {
                                handleUpdateRole(
                                  member.id,
                                  value as OrganizationRole,
                                )
                              }
                            }}
                            disabled={isBusy}
                          >
                            <SelectTrigger
                              size="sm"
                              aria-label={`Change role for ${member.user.name}`}
                              className="h-8 w-32 capitalize text-xs font-medium cursor-pointer"
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent align="start">
                              {isOwner && (
                                <SelectItem value="owner">
                                  <div className="flex items-center gap-1.5">
                                    <HugeiconsIcon
                                      icon={CrownIcon}
                                      size={12}
                                      className="text-muted-foreground"
                                    />
                                    <span>Owner</span>
                                  </div>
                                </SelectItem>
                              )}
                              <SelectItem value="admin">
                                <div className="flex items-center gap-1.5">
                                  <HugeiconsIcon
                                    icon={Shield01Icon}
                                    size={12}
                                    className="text-muted-foreground"
                                  />
                                  <span>Admin</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="member">
                                <div className="flex items-center gap-1.5">
                                  <HugeiconsIcon
                                    icon={UserIcon}
                                    size={12}
                                    className="text-muted-foreground"
                                  />
                                  <span>Member</span>
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge
                            variant={
                              member.role === "owner"
                                ? "default"
                                : member.role === "admin"
                                  ? "secondary"
                                  : "outline"
                            }
                            className="capitalize text-xs font-normal gap-1"
                          >
                            {member.role === "owner" && (
                              <HugeiconsIcon
                                icon={CrownIcon}
                                size={12}
                                className="text-muted-foreground"
                              />
                            )}
                            {member.role === "admin" && (
                              <HugeiconsIcon
                                icon={Shield01Icon}
                                size={12}
                                className="text-muted-foreground"
                              />
                            )}
                            <span>{member.role}</span>
                          </Badge>
                        )}
                      </TableCell>

                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(member.createdAt).toLocaleDateString(
                          undefined,
                          {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          },
                        )}
                      </TableCell>

                      <TableCell className="pe-4 text-right">
                        {isBusy ? (
                          <HugeiconsIcon
                            icon={Loading03Icon}
                            size={16}
                            className="animate-spin text-muted-foreground ml-auto"
                          />
                        ) : (
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button
                                  variant="ghost"
                                  size="icon-xs"
                                  aria-label={`Actions for ${member.user.name}`}
                                  className="cursor-pointer"
                                />
                              }
                            >
                              <HugeiconsIcon
                                icon={MoreHorizontalIcon}
                                size={16}
                              />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuGroup>
                                <DropdownMenuItem
                                  render={
                                    <a href={`mailto:${member.user.email}`} />
                                  }
                                  className="flex items-center gap-2 cursor-pointer"
                                >
                                  <HugeiconsIcon icon={Mail01Icon} size={14} />
                                  <span>Send email</span>
                                </DropdownMenuItem>
                              </DropdownMenuGroup>

                              {isOwner && !isMemberOwner && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuGroup>
                                    <DropdownMenuLabel>
                                      Role Assignment
                                    </DropdownMenuLabel>
                                    <DropdownMenuItem
                                      onClick={() =>
                                        handleUpdateRole(member.id, "owner")
                                      }
                                      className="cursor-pointer"
                                    >
                                      <HugeiconsIcon
                                        icon={CrownIcon}
                                        size={14}
                                        className="text-muted-foreground"
                                      />
                                      <span>Transfer Ownership</span>
                                    </DropdownMenuItem>
                                  </DropdownMenuGroup>
                                </>
                              )}

                              <DropdownMenuSeparator />

                              <DropdownMenuGroup>
                                {isSoleOwner ? (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger
                                        render={
                                          <div className="w-full">
                                            <DropdownMenuItem
                                              disabled
                                              variant="destructive"
                                            >
                                              <HugeiconsIcon
                                                icon={Delete02Icon}
                                                size={14}
                                              />
                                              {isCurrentUser
                                                ? "Leave Organization"
                                                : "Remove Member"}
                                            </DropdownMenuItem>
                                          </div>
                                        }
                                      />
                                      <TooltipContent side="left">
                                        Sole owner cannot leave or be removed.
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                ) : canRemove ? (
                                  <DropdownMenuItem
                                    variant="destructive"
                                    onClick={() =>
                                      handleRemoveMember(
                                        member.id,
                                        member.user.name,
                                        isCurrentUser,
                                      )
                                    }
                                    className="cursor-pointer"
                                  >
                                    <HugeiconsIcon
                                      icon={Delete02Icon}
                                      size={14}
                                    />
                                    {isCurrentUser
                                      ? "Leave Organization"
                                      : "Remove Member"}
                                  </DropdownMenuItem>
                                ) : null}
                              </DropdownMenuGroup>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
      </section>

      {/* Pending Invitations Section (Owner/Admin only) */}
      {isOwnerOrAdmin && (
        <section className="flex flex-col gap-3">
          <div>
            <h3 className="font-heading text-lg font-medium flex items-center gap-2">
              <HugeiconsIcon icon={Mail01Icon} size={18} />
              Pending Invitations ({invitations.length})
            </h3>
            <p className="text-xs text-muted-foreground">
              Invitations sent that have not yet been accepted.
            </p>
          </div>

          {isLoadingInvitations ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Loading invitations…
            </div>
          ) : invitationsError ? (
            <div className="rounded-lg border border-destructive/30 p-6 text-center text-sm text-destructive">
              Failed to load pending invitations.
            </div>
          ) : invitations.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/70 p-6 text-center text-xs text-muted-foreground">
              No pending invitations.
            </div>
          ) : (
            <div className="rounded-lg border border-border/80 bg-card overflow-hidden shadow-xs">
              <ScrollArea className="w-full">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="ps-4">Email</TableHead>
                      <TableHead>Invited Role</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead className="pe-4 w-[70px] text-right">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invitations.map((inv) => {
                      const isBusy = loadingActionIds.has(inv.id)
                      return (
                        <TableRow key={inv.id}>
                          <TableCell className="ps-4 font-mono text-xs">
                            <div className="flex items-center gap-2">
                              <span>{inv.email}</span>
                              <Badge
                                variant="outline"
                                className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground px-1.5 py-0"
                              >
                                pending
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className="capitalize text-xs font-normal"
                            >
                              {inv.role}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(inv.expiresAt).toLocaleDateString(
                              undefined,
                              {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              },
                            )}
                          </TableCell>
                          <TableCell className="pe-4 text-right">
                            {isBusy ? (
                              <HugeiconsIcon
                                icon={Loading03Icon}
                                size={16}
                                className="animate-spin text-muted-foreground ml-auto"
                              />
                            ) : (
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                aria-label={`Revoke invitation for ${inv.email}`}
                                onClick={() =>
                                  handleCancelInvitation(inv.id, inv.email)
                                }
                                className="cursor-pointer text-muted-foreground hover:text-destructive"
                              >
                                <HugeiconsIcon icon={Cancel01Icon} size={14} />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
