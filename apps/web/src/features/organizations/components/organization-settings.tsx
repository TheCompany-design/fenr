import {
  Building01Icon,
  CrownIcon,
  Mail01Icon,
  Shield01Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useQueryClient } from "@tanstack/react-query"
import { Badge } from "@workspace/ui/components/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { cn } from "@workspace/ui/lib/utils"
import * as React from "react"

import { invalidateOrganizationQueries } from "../queries"
import type { OrganizationRole } from "../schemas"
import { type ActiveOrganization, inviteMemberFn } from "../server"
import { InviteMembersForm } from "./invite-members-form"
import { OrganizationAvatar } from "./organization-avatar"
import { OrganizationMembers } from "./organization-members"

export interface OrganizationSettingsProps {
  activeOrganization: ActiveOrganization
  currentUserId: string
  className?: string
}

export function OrganizationSettings({
  activeOrganization,
  currentUserId,
  className,
}: OrganizationSettingsProps) {
  const queryClient = useQueryClient()
  const org = activeOrganization.organization
  const role: OrganizationRole =
    activeOrganization.role === "owner" || activeOrganization.role === "admin"
      ? activeOrganization.role
      : "member"
  const isOwnerOrAdmin = role === "owner" || role === "admin"

  const handleInviteBatch = React.useCallback(
    async (
      invites: Array<{ email: string; role: OrganizationRole }>,
    ): Promise<Array<{ email: string; success: boolean; error?: string }>> => {
      const results = await Promise.all(
        invites.map(async (invite) => {
          try {
            await inviteMemberFn({
              data: {
                organizationId: org.id,
                email: invite.email,
                role: invite.role,
              },
            })
            return { email: invite.email, success: true }
          } catch (err) {
            return {
              email: invite.email,
              success: false,
              error:
                err instanceof Error
                  ? err.message
                  : "Failed to send invitation",
            }
          }
        }),
      )
      await invalidateOrganizationQueries(queryClient, org.id)
      return results
    },
    [org.id, queryClient],
  )

  return (
    <div
      className={cn("mx-auto flex w-full max-w-5xl flex-col gap-8", className)}
    >
      {/* Header Profile Section */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-6">
        <div className="flex items-center gap-4">
          <OrganizationAvatar
            name={org.name}
            slug={org.slug}
            logo={org.logo}
            size="lg"
            className="size-16 rounded-2xl border-2 border-border shadow-xs text-xl"
          />
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h1 className="font-semibold text-2xl tracking-tight text-foreground sm:text-3xl">
                {org.name}
              </h1>
              <Badge
                variant={
                  role === "owner"
                    ? "default"
                    : role === "admin"
                      ? "secondary"
                      : "outline"
                }
                className="capitalize text-xs font-normal"
              >
                {role === "owner" && (
                  <HugeiconsIcon icon={CrownIcon} size={12} className="mr-1" />
                )}
                {role === "admin" && (
                  <HugeiconsIcon
                    icon={Shield01Icon}
                    size={12}
                    className="mr-1"
                  />
                )}
                {role}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground font-mono">
              fenr.app/{org.slug}
            </p>
          </div>
        </div>
      </header>

      {/* General Information Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <HugeiconsIcon icon={Building01Icon} size={18} />
            Organization Details
          </CardTitle>
          <CardDescription>
            General workspace properties and configuration.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div className="flex flex-col gap-1 p-3 rounded-lg border border-border/60 bg-muted/20">
            <span className="text-xs font-medium text-muted-foreground">
              Organization Name
            </span>
            <span className="font-semibold text-foreground">{org.name}</span>
          </div>
          <div className="flex flex-col gap-1 p-3 rounded-lg border border-border/60 bg-muted/20">
            <span className="text-xs font-medium text-muted-foreground">
              Workspace URL
            </span>
            <span className="font-mono text-foreground">
              fenr.app/{org.slug}
            </span>
          </div>
          <div className="flex flex-col gap-1 p-3 rounded-lg border border-border/60 bg-muted/20">
            <span className="text-xs font-medium text-muted-foreground">
              Total Members
            </span>
            <span className="text-foreground">
              {activeOrganization.memberCount}{" "}
              {activeOrganization.memberCount === 1 ? "member" : "members"}
            </span>
          </div>
          <div className="flex flex-col gap-1 p-3 rounded-lg border border-border/60 bg-muted/20">
            <span className="text-xs font-medium text-muted-foreground">
              Created Date
            </span>
            <span className="text-foreground">
              {new Date(org.createdAt).toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Invite Teammates Section (Owner/Admin only) */}
      {isOwnerOrAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <HugeiconsIcon icon={Mail01Icon} size={18} />
              Invite Teammates
            </CardTitle>
            <CardDescription>
              Invite coworkers and collaborators to join {org.name}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <InviteMembersForm
              organizationId={org.id}
              onInvite={handleInviteBatch}
              allowedRoles={role === "owner" ? ["member", "admin"] : ["member"]}
              submitLabel="Send Invitations"
            />
          </CardContent>
        </Card>
      )}

      {/* Members & Invitations Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <HugeiconsIcon icon={UserGroupIcon} size={18} />
            Members &amp; Permissions
          </CardTitle>
          <CardDescription>
            View active teammates, assign administrative roles, and manage
            access.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OrganizationMembers
            organizationId={org.id}
            currentUserId={currentUserId}
            currentUserRole={role}
          />
        </CardContent>
      </Card>
    </div>
  )
}
