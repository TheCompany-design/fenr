import {
  AlertCircleIcon,
  Loading03Icon,
  Mail01Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "@tanstack/react-router"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { cn } from "@workspace/ui/lib/utils"
import * as React from "react"
import { toast } from "sonner"
import type { OrganizationRole } from "@/lib/schemas/organizations"
import { useConfirmStore } from "@/lib/stores/confirm.store"
import {
  invalidateOrganizationQueries,
  organizationInvitationsQueryOptions,
  organizationMembersQueryOptions,
} from "../queries"
import {
  cancelInvitationFn,
  removeMemberFn,
  updateMemberRoleFn,
} from "../server"
import { MemberRow } from "./member-row"
import { PendingInvitationRow } from "./pending-invitation-row"

export { MemberRow, PendingInvitationRow }

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
      } catch {
        toast.warning("Role updated", {
          description: "The change was saved. Refresh the page to see it.",
        })
      }
    } catch {
      toast.error("Failed to update role", {
        description: "Could not update member role. Please try again.",
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
      } catch {
        toast.warning(isSelf ? "You left the organization" : "Member removed", {
          description: "The change was saved. Refresh the page to see it.",
        })
      }
      if (isSelf) {
        try {
          await router.navigate({ to: "/", replace: true })
          await router.invalidate()
        } catch {
          toast.warning("You left the organization", {
            description: "Refresh the page to continue.",
          })
        }
      }
    } catch {
      toast.error("Failed to remove member", {
        description: "Could not remove member. Please try again.",
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
      } catch {
        toast.warning("Invitation revoked", {
          description: "The change was saved. Refresh the page to see it.",
        })
      }
    } catch {
      toast.error("Failed to cancel invitation", {
        description: "Could not revoke invitation. Please try again.",
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

                  return (
                    <MemberRow
                      key={member.id}
                      member={member}
                      tone={tone}
                      initials={initials}
                      isCurrentUser={isCurrentUser}
                      isOwner={isOwner}
                      isMemberOwner={isMemberOwner}
                      isSoleOwner={isSoleOwner}
                      currentUserRole={currentUserRole}
                      isBusy={isBusy}
                      onUpdateRole={handleUpdateRole}
                      onRemoveMember={handleRemoveMember}
                    />
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
                    {invitations.map((inv) => (
                      <PendingInvitationRow
                        key={inv.id}
                        invitation={inv}
                        isBusy={loadingActionIds.has(inv.id)}
                        onCancelInvitation={handleCancelInvitation}
                      />
                    ))}
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
