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

  const members = membersData?.members ?? []

  const { data: invitations = [], isLoading: isLoadingInvitations } = useQuery({
    ...organizationInvitationsQueryOptions(organizationId),
    enabled: isOwnerOrAdmin,
  })

  // Track pending action per member/invitation id for spinners
  const [actionLoadingId, setActionLoadingId] = React.useState<string | null>(
    null,
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
    setActionLoadingId(memberId)
    try {
      await updateMemberRoleFn({
        data: {
          organizationId,
          memberId,
          role: newRole,
        },
      })
      toast.success("Member role updated")
      await invalidateOrganizationQueries(queryClient, organizationId)
    } catch (err) {
      toast.error("Failed to update role", {
        description:
          err instanceof Error ? err.message : "An unexpected error occurred",
      })
    } finally {
      setActionLoadingId(null)
    }
  }

  const handleRemoveMember = async (
    memberId: string,
    memberName: string,
    isSelf: boolean,
  ) => {
    const confirmed = await openConfirm({
      title: isSelf ? "Leave organization?" : `Remove ${memberName}?`,
      description: isSelf
        ? "You will lose access to all resources in this organization until re-invited."
        : `Are you sure you want to remove ${memberName} from this organization?`,
      confirmText: isSelf ? "Leave" : "Remove",
      variant: "destructive",
    })

    if (!confirmed) return

    setActionLoadingId(memberId)
    try {
      await removeMemberFn({
        data: {
          organizationId,
          memberId,
        },
      })
      toast.success(isSelf ? "You left the organization" : "Member removed")
      await invalidateOrganizationQueries(queryClient, organizationId)
    } catch (err) {
      toast.error("Failed to remove member", {
        description:
          err instanceof Error ? err.message : "An unexpected error occurred",
      })
    } finally {
      setActionLoadingId(null)
    }
  }

  const handleCancelInvitation = async (
    invitationId: string,
    email: string,
  ) => {
    const confirmed = await openConfirm({
      title: "Revoke invitation?",
      description: `Revoke the pending invitation for ${email}? They will no longer be able to use the invitation link.`,
      confirmText: "Revoke",
      variant: "destructive",
    })

    if (!confirmed) return

    setActionLoadingId(invitationId)
    try {
      await cancelInvitationFn({
        data: {
          organizationId,
          invitationId,
        },
      })
      toast.success("Invitation revoked")
      await invalidateOrganizationQueries(queryClient, organizationId)
    } catch (err) {
      toast.error("Failed to cancel invitation", {
        description:
          err instanceof Error ? err.message : "An unexpected error occurred",
      })
    } finally {
      setActionLoadingId(null)
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
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-medium flex items-center gap-2">
              <HugeiconsIcon icon={UserGroupIcon} size={18} />
              Members ({members.length})
            </h3>
            <p className="text-xs text-muted-foreground">
              Manage member roles and workspace access.
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <ScrollArea className="w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[300px]">User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="w-[80px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => {
                  const isCurrentUser = member.userId === currentUserId
                  const isMemberOwner = member.role === "owner"
                  const isSoleOwner = isMemberOwner && ownerCount <= 1
                  const isBusy = actionLoadingId === member.id

                  // Can current user manage this member?
                  // Owners can manage anyone (except sole owner demotion/removal).
                  // Admins can only manage regular members.
                  const canManage =
                    isOwner ||
                    (currentUserRole === "admin" && member.role === "member") ||
                    isCurrentUser

                  return (
                    <TableRow key={member.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="size-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-xs shrink-0 select-none">
                            {member.user.image ? (
                              <img
                                src={member.user.image}
                                alt={member.user.name}
                                className="size-full rounded-full object-cover"
                              />
                            ) : (
                              member.user.name.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm font-medium truncate flex items-center gap-1.5">
                              {member.user.name}
                              {isCurrentUser && (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] px-1.5 py-0"
                                >
                                  You
                                </Badge>
                              )}
                            </span>
                            <span className="text-xs text-muted-foreground truncate">
                              {member.user.email}
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <Badge
                          variant={
                            member.role === "owner"
                              ? "default"
                              : member.role === "admin"
                                ? "secondary"
                                : "outline"
                          }
                          className="capitalize text-xs font-normal"
                        >
                          {member.role === "owner" && (
                            <HugeiconsIcon
                              icon={CrownIcon}
                              size={12}
                              className="mr-1"
                            />
                          )}
                          {member.role === "admin" && (
                            <HugeiconsIcon
                              icon={Shield01Icon}
                              size={12}
                              className="mr-1"
                            />
                          )}
                          {member.role}
                        </Badge>
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

                      <TableCell className="text-right">
                        {isBusy ? (
                          <HugeiconsIcon
                            icon={Loading03Icon}
                            size={16}
                            className="animate-spin text-muted-foreground ml-auto"
                          />
                        ) : canManage ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button
                                  variant="ghost"
                                  size="icon-xs"
                                  aria-label="Member actions"
                                />
                              }
                            >
                              <HugeiconsIcon
                                icon={MoreHorizontalIcon}
                                size={16}
                              />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuGroup>
                                <DropdownMenuLabel>
                                  Change Role
                                </DropdownMenuLabel>
                                {isOwner && (
                                  <DropdownMenuItem
                                    disabled={member.role === "owner"}
                                    onClick={() =>
                                      handleUpdateRole(member.id, "owner")
                                    }
                                  >
                                    <HugeiconsIcon icon={CrownIcon} size={14} />
                                    Make Owner
                                  </DropdownMenuItem>
                                )}
                                {(isOwner || currentUserRole === "admin") && (
                                  <DropdownMenuItem
                                    disabled={
                                      member.role === "admin" ||
                                      (isSoleOwner && member.role === "owner")
                                    }
                                    onClick={() =>
                                      handleUpdateRole(member.id, "admin")
                                    }
                                  >
                                    <HugeiconsIcon
                                      icon={Shield01Icon}
                                      size={14}
                                    />
                                    Make Admin
                                  </DropdownMenuItem>
                                )}
                                {(isOwner || currentUserRole === "admin") && (
                                  <DropdownMenuItem
                                    disabled={
                                      member.role === "member" ||
                                      (isSoleOwner && member.role === "owner")
                                    }
                                    onClick={() =>
                                      handleUpdateRole(member.id, "member")
                                    }
                                  >
                                    <HugeiconsIcon icon={UserIcon} size={14} />
                                    Make Member
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuGroup>

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
                                                ? "Leave"
                                                : "Remove"}
                                            </DropdownMenuItem>
                                          </div>
                                        }
                                      />
                                      <TooltipContent side="left">
                                        Sole owner cannot leave or be removed.
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                ) : (
                                  <DropdownMenuItem
                                    variant="destructive"
                                    onClick={() =>
                                      handleRemoveMember(
                                        member.id,
                                        member.user.name,
                                        isCurrentUser,
                                      )
                                    }
                                  >
                                    <HugeiconsIcon
                                      icon={Delete02Icon}
                                      size={14}
                                    />
                                    {isCurrentUser
                                      ? "Leave Organization"
                                      : "Remove Member"}
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuGroup>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : null}
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
            <h3 className="text-base font-medium flex items-center gap-2">
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
          ) : invitations.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
              No pending invitations.
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <ScrollArea className="w-full">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Invited Role</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead className="w-[80px] text-right">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invitations.map((inv) => {
                      const isBusy = actionLoadingId === inv.id
                      return (
                        <TableRow key={inv.id}>
                          <TableCell className="font-mono text-xs">
                            {inv.email}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className="capitalize text-xs"
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
                          <TableCell className="text-right">
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
                                title="Revoke invitation"
                                onClick={() =>
                                  handleCancelInvitation(inv.id, inv.email)
                                }
                              >
                                <HugeiconsIcon
                                  icon={Cancel01Icon}
                                  size={14}
                                  className="text-destructive"
                                />
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
