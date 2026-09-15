import {
  Alert02Icon,
  Building01Icon,
  Delete02Icon,
  Loading03Icon,
  Mail01Icon,
  Tick02Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useForm, useStore } from "@tanstack/react-form"
import { useQueryClient } from "@tanstack/react-query"
import { useRouter } from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Separator } from "@workspace/ui/components/separator"
import { cn } from "@workspace/ui/lib/utils"
import * as React from "react"
import { toast } from "sonner"
import {
  type OrganizationRole,
  updateOrganizationSchema,
} from "@/lib/schemas/organizations"
import { useConfirmStore } from "@/lib/stores/confirm.store"
import { invalidateOrganizationQueries } from "../queries"
import {
  type ActiveOrganization,
  deleteOrganizationFn,
  inviteMemberFn,
  leaveOrganizationFn,
  updateOrganizationFn,
} from "../server"
import { InviteMembersForm } from "./invite-members-form"
import { OrganizationMembers } from "./organization-members"

export interface OrganizationSettingsProps {
  activeOrganization: ActiveOrganization
  currentUserId: string
  section?: "all" | "general" | "members" | "danger"
  className?: string
}

export function OrganizationSettings({
  activeOrganization,
  currentUserId,
  section = "all",
  className,
}: OrganizationSettingsProps) {
  const queryClient = useQueryClient()
  const router = useRouter({ warn: false })
  const openConfirm = useConfirmStore((state) => state.openConfirm)
  const org = activeOrganization.organization
  const role: OrganizationRole =
    activeOrganization.role === "owner" || activeOrganization.role === "admin"
      ? activeOrganization.role
      : "member"
  const isOwner = role === "owner"
  const isOwnerOrAdmin = isOwner || role === "admin"
  const showGeneral = section === "all" || section === "general"
  const showMembers = section === "all" || section === "members"
  const showDanger = section === "all" || section === "danger"

  const form = useForm({
    defaultValues: {
      organizationId: org.id,
      name: org.name,
      slug: org.slug,
      logo: org.logo,
    },
    validators: {
      onBlur: updateOrganizationSchema,
      onSubmit: updateOrganizationSchema,
    },
    onSubmit: async ({ value }) => {
      try {
        const updated = await updateOrganizationFn({ data: value })
        form.reset({
          organizationId: updated.id,
          name: updated.name,
          slug: updated.slug,
          logo: updated.logo,
        })
        toast.success("Workspace settings saved")
        try {
          await invalidateOrganizationQueries(queryClient, org.id)
          await router.invalidate()
        } catch {
          toast.warning("Workspace settings saved", {
            description: "Refresh the page to see the latest workspace data.",
          })
        }
      } catch {
        toast.error("Could not save workspace settings", {
          description: "Check the values and try again.",
        })
      }
    },
  })

  const isDirty = useStore(form.store, (state) => state.isDirty)
  const isSubmitting = useStore(form.store, (state) => state.isSubmitting)

  const handleDiscard = () => {
    form.reset({
      organizationId: org.id,
      name: org.name,
      slug: org.slug,
      logo: org.logo,
    })
  }

  const handleLeave = async () => {
    const confirmed = await openConfirm({
      title: "Leave organization?",
      description: "You will lose access to this workspace.",
      confirmText: "Leave organization",
      variant: "destructive",
    })
    if (!confirmed) return
    try {
      await leaveOrganizationFn({ data: { organizationId: org.id } })
      toast.success("You left the organization")
      try {
        await invalidateOrganizationQueries(queryClient, org.id)
      } catch {
        // Best-effort cache invalidation
      }
      await router.navigate({ to: "/", replace: true })
    } catch (err) {
      toast.error("Could not leave organization", {
        description: err instanceof Error ? err.message : "Please try again.",
      })
    }
  }

  const handleDelete = async () => {
    const confirmed = await openConfirm({
      title: `Delete ${org.name}?`,
      description:
        "This permanently removes the workspace, its members, and invitations.",
      confirmText: "Delete organization",
      variant: "destructive",
    })
    if (!confirmed) return
    try {
      await deleteOrganizationFn({ data: { organizationId: org.id } })
      toast.success("Organization deleted")
      try {
        await invalidateOrganizationQueries(queryClient, org.id)
      } catch {
        // Best-effort cache invalidation
      }
      await router.navigate({ to: "/", replace: true })
    } catch (err) {
      toast.error("Could not delete organization", {
        description: err instanceof Error ? err.message : "Please try again.",
      })
    }
  }

  const handleInviteBatch = React.useCallback(
    async (
      invites: Array<{ email: string; role: OrganizationRole; note?: string }>,
    ): Promise<Array<{ email: string; success: boolean; error?: string }>> => {
      const results = await Promise.all(
        invites.map(async (invite) => {
          try {
            const res = await inviteMemberFn({
              data: {
                organizationId: org.id,
                email: invite.email,
                role: invite.role,
                note: invite.note,
              },
            })
            if (!res.emailSent) {
              toast.warning(
                `Invitation created for ${invite.email}, but email could not be delivered`,
                {
                  description: "Please copy the invite link to share manually.",
                },
              )
            }
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
      try {
        await invalidateOrganizationQueries(queryClient, org.id)
      } catch {
        // Best-effort cache invalidation
      }
      return results
    },
    [org.id, queryClient],
  )

  return (
    <div className={cn("flex min-w-0 flex-col gap-8", className)}>
      {showGeneral && (
        <section id="general" aria-labelledby="general-heading">
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void form.handleSubmit()
            }}
          >
            <Card>
              <CardHeader>
                <CardTitle
                  id="general-heading"
                  className="flex items-center gap-2 text-base"
                >
                  <HugeiconsIcon icon={Building01Icon} size={18} />
                  General
                </CardTitle>
                <CardDescription>
                  Update the identity and public URL for this workspace.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-8">
                <form.Field name="name">
                  {(field) => (
                    <div className="grid gap-2 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-start sm:gap-10">
                      <div>
                        <Label htmlFor="organization-settings-name">
                          Workspace name
                        </Label>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                          Shown in invitations and navigation.
                        </p>
                      </div>
                      <Input
                        id="organization-settings-name"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        disabled={!isOwner || isSubmitting}
                        aria-invalid={
                          field.state.meta.isTouched &&
                          field.state.meta.errors.length > 0
                        }
                      />
                    </div>
                  )}
                </form.Field>
                <form.Field name="slug">
                  {(field) => (
                    <div className="grid gap-2 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-start sm:gap-10">
                      <div>
                        <Label htmlFor="organization-settings-slug">
                          Workspace URL
                        </Label>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                          Use lowercase letters, numbers, and hyphens.
                        </p>
                      </div>
                      <div className="flex items-center rounded-lg border border-input bg-background">
                        <span className="select-none px-3 font-mono text-sm text-muted-foreground">
                          fenr.app/
                        </span>
                        <Input
                          id="organization-settings-slug"
                          className="border-0 pl-0 font-mono focus-visible:ring-0"
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) =>
                            field.handleChange(e.target.value.toLowerCase())
                          }
                          disabled={!isOwner || isSubmitting}
                          aria-invalid={
                            field.state.meta.isTouched &&
                            field.state.meta.errors.length > 0
                          }
                        />
                      </div>
                    </div>
                  )}
                </form.Field>
                <form.Field name="logo">
                  {(field) => (
                    <div className="grid gap-2 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-start sm:gap-10">
                      <div>
                        <Label htmlFor="organization-settings-logo">
                          Logo URL
                        </Label>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                          Optional image URL for the workspace avatar.
                        </p>
                      </div>
                      <Input
                        id="organization-settings-logo"
                        type="url"
                        placeholder="https://…"
                        value={field.state.value ?? ""}
                        onBlur={field.handleBlur}
                        onChange={(e) =>
                          field.handleChange(e.target.value || null)
                        }
                        disabled={!isOwner || isSubmitting}
                        aria-invalid={
                          field.state.meta.isTouched &&
                          field.state.meta.errors.length > 0
                        }
                      />
                    </div>
                  )}
                </form.Field>
              </CardContent>
              <form.Subscribe
                selector={(state) => [state.canSubmit, state.isSubmitting]}
              >
                {([canSubmit, submitting]) => (
                  <CardFooter className="justify-end gap-2 border-t border-border pt-6">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleDiscard}
                      disabled={!isDirty || submitting}
                    >
                      Discard
                    </Button>
                    <Button
                      type="submit"
                      disabled={
                        !isOwner || !isDirty || !canSubmit || submitting
                      }
                    >
                      {submitting ? (
                        <HugeiconsIcon
                          icon={Loading03Icon}
                          size={16}
                          className="animate-spin"
                        />
                      ) : (
                        <HugeiconsIcon icon={Tick02Icon} size={16} />
                      )}
                      Save changes
                    </Button>
                  </CardFooter>
                )}
              </form.Subscribe>
            </Card>
          </form>
        </section>
      )}

      {showMembers && (
        <section id="members" aria-labelledby="members-heading">
          <Card>
            <CardHeader>
              <CardTitle
                id="members-heading"
                className="flex items-center gap-2 text-base"
              >
                <HugeiconsIcon icon={UserGroupIcon} size={18} />
                Members &amp; invites
              </CardTitle>
              <CardDescription>
                Manage workspace access and pending invitations.
              </CardDescription>
            </CardHeader>
            {isOwnerOrAdmin && (
              <CardContent className="border-b border-border pb-8">
                <div className="mb-4 flex items-center gap-2">
                  <HugeiconsIcon icon={Mail01Icon} size={18} />
                  <h3 className="font-medium text-sm">Invite teammates</h3>
                </div>
                <InviteMembersForm
                  organizationId={org.id}
                  onInvite={handleInviteBatch}
                  allowedRoles={isOwner ? ["member", "admin"] : ["member"]}
                  submitLabel="Send invitations"
                />
              </CardContent>
            )}
            <CardContent className="pt-8">
              <OrganizationMembers
                organizationId={org.id}
                currentUserId={currentUserId}
                currentUserRole={role}
              />
            </CardContent>
          </Card>
        </section>
      )}

      {showDanger && (
        <section id="danger" aria-labelledby="danger-heading">
          <Card className="border-destructive/40">
            <CardHeader>
              <CardTitle
                id="danger-heading"
                className="flex items-center gap-2 text-base text-destructive"
              >
                <HugeiconsIcon icon={Alert02Icon} size={18} />
                Danger zone
              </CardTitle>
              <CardDescription>
                These actions affect access for you and everyone in the
                workspace.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-medium text-sm">Leave organization</h3>
                  <p className="text-xs text-muted-foreground">
                    Remove your membership from this workspace.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleLeave()}
                  disabled={isOwner && activeOrganization.memberCount <= 1}
                >
                  Leave organization
                </Button>
              </div>
              {isOwner && (
                <>
                  <Separator />
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="font-medium text-sm">
                        Delete organization
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Permanently delete this workspace and its data.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => void handleDelete()}
                    >
                      <HugeiconsIcon icon={Delete02Icon} size={16} />
                      Delete organization
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  )
}
