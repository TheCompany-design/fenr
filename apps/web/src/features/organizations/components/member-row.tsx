import {
  CrownIcon,
  Delete02Icon,
  Loading03Icon,
  Mail01Icon,
  MoreHorizontalIcon,
  Shield01Icon,
  UserIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { TableCell, TableRow } from "@workspace/ui/components/table"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { cn } from "@workspace/ui/lib/utils"

import type { OrganizationRole } from "@/lib/schemas/organizations"

export interface MemberRowProps {
  member: {
    id: string
    userId: string
    role: string
    createdAt: Date
    user: {
      id: string
      name: string
      email: string
      image: string | null
    }
  }
  tone: string
  initials: string
  isCurrentUser: boolean
  isOwner: boolean
  isMemberOwner: boolean
  isSoleOwner: boolean
  currentUserRole: OrganizationRole
  isBusy: boolean
  onUpdateRole: (memberId: string, role: OrganizationRole) => void
  onRemoveMember: (
    memberId: string,
    name: string,
    isCurrentUser: boolean,
  ) => void
}

export function MemberRow({
  member,
  tone,
  initials,
  isCurrentUser,
  isOwner,
  isMemberOwner,
  isSoleOwner,
  currentUserRole,
  isBusy,
  onUpdateRole,
  onRemoveMember,
}: MemberRowProps) {
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
      (currentUserRole === "admin" && member.role === "member") ||
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
                onUpdateRole(member.id, value as OrganizationRole)
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
        {new Date(member.createdAt).toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        })}
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
              <HugeiconsIcon icon={MoreHorizontalIcon} size={16} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuGroup>
                <DropdownMenuItem
                  render={<a href={`mailto:${member.user.email}`} />}
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
                    <DropdownMenuLabel>Role Assignment</DropdownMenuLabel>
                    <DropdownMenuItem
                      onClick={() => onUpdateRole(member.id, "owner")}
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
                            <DropdownMenuItem disabled variant="destructive">
                              <HugeiconsIcon icon={Delete02Icon} size={14} />
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
                      onRemoveMember(member.id, member.user.name, isCurrentUser)
                    }
                    className="cursor-pointer"
                  >
                    <HugeiconsIcon icon={Delete02Icon} size={14} />
                    {isCurrentUser ? "Leave Organization" : "Remove Member"}
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </TableCell>
    </TableRow>
  )
}
