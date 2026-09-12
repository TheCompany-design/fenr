import {
  Add01Icon,
  AlertCircleIcon,
  Cancel01Icon,
  CheckmarkCircle01Icon,
  Loading03Icon,
  Mail01Icon,
  RefreshIcon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import { cn } from "@workspace/ui/lib/utils"
import * as React from "react"
import { toast } from "sonner"
import { z } from "zod"

import type { OrganizationRole } from "../schemas"

export interface QueuedInvite {
  id: string
  email: string
  role: OrganizationRole
  status: "pending" | "sending" | "success" | "error"
  error?: string
}

export interface InviteMembersFormProps {
  organizationId?: string
  onInvite: (
    invites: Array<{ email: string; role: OrganizationRole }>,
  ) => Promise<Array<{ email: string; success: boolean; error?: string }>>
  onComplete?: () => void
  onSkip?: () => void
  skipLabel?: string
  submitLabel?: string
  className?: string
  allowedRoles?: OrganizationRole[]
}

const singleEmailSchema = z
  .string()
  .trim()
  .email("Enter a valid email address")
  .max(255, "Email cannot exceed 255 characters")
  .transform((val) => val.toLowerCase())

export function InviteMembersForm({
  onInvite,
  onComplete,
  onSkip,
  skipLabel = "Skip for now",
  submitLabel = "Send Invitations",
  className,
  allowedRoles = ["member", "admin"],
}: InviteMembersFormProps) {
  const [emailInput, setEmailInput] = React.useState("")
  const [selectedRole, setSelectedRole] =
    React.useState<OrganizationRole>("member")
  const [invites, setInvites] = React.useState<QueuedInvite[]>([])
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [inputError, setInputError] = React.useState<string | null>(null)

  const handleAddInvite = () => {
    setInputError(null)
    const trimmed = emailInput.trim()
    if (!trimmed) return

    const parsed = singleEmailSchema.safeParse(trimmed)
    if (!parsed.success) {
      setInputError(parsed.error.issues[0]?.message ?? "Invalid email address")
      return
    }

    const email = parsed.data
    const isDuplicate = invites.some((i) => i.email === email)
    if (isDuplicate) {
      setInputError("This email has already been added to the list")
      return
    }

    setInvites((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        email,
        role: selectedRole,
        status: "pending",
      },
    ])
    setEmailInput("")
  }

  const handleRemoveInvite = (id: string) => {
    setInvites((prev) => prev.filter((i) => i.id !== id))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleAddInvite()
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // If input is non-empty, try adding it first
    if (emailInput.trim()) {
      handleAddInvite()
    }

    const pendingInvites = invites.filter((i) => i.status !== "success")
    if (pendingInvites.length === 0) {
      toast.info("No invitations to send", {
        description: "Add one or more email addresses first.",
      })
      return
    }

    setIsSubmitting(true)
    setInvites((prev) =>
      prev.map((i) =>
        i.status !== "success"
          ? { ...i, status: "sending", error: undefined }
          : i,
      ),
    )

    try {
      const payload = pendingInvites.map((i) => ({
        email: i.email,
        role: i.role,
      }))

      const results = await onInvite(payload)

      setInvites((prev) =>
        prev.map((item) => {
          const res = results.find(
            (r) => r.email.toLowerCase() === item.email.toLowerCase(),
          )
          if (!res) return item
          return {
            ...item,
            status: res.success ? "success" : "error",
            error: res.error,
          }
        }),
      )

      const successCount = results.filter((r) => r.success).length
      const failureCount = results.filter((r) => !r.success).length

      if (failureCount === 0) {
        toast.success(
          successCount === 1
            ? "Invitation sent"
            : `${successCount} invitations sent`,
        )
        onComplete?.()
      } else if (successCount > 0) {
        toast.warning(
          `${successCount} invitation(s) sent, ${failureCount} failed`,
          {
            description: "Review failed invitations and click retry.",
          },
        )
      } else {
        toast.error("Failed to send invitations", {
          description: "Please check the errors and try again.",
        })
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to send invitations"
      toast.error("Invitation error", { description: message })
      setInvites((prev) =>
        prev.map((i) =>
          i.status === "sending"
            ? { ...i, status: "error", error: message }
            : i,
        ),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRetryFailed = async (invite: QueuedInvite) => {
    setIsSubmitting(true)
    setInvites((prev) =>
      prev.map((i) =>
        i.id === invite.id ? { ...i, status: "sending", error: undefined } : i,
      ),
    )

    try {
      const results = await onInvite([
        { email: invite.email, role: invite.role },
      ])
      const res = results[0]
      if (res?.success) {
        toast.success(`Invitation sent to ${invite.email}`)
        setInvites((prev) =>
          prev.map((i) =>
            i.id === invite.id
              ? { ...i, status: "success", error: undefined }
              : i,
          ),
        )
      } else {
        setInvites((prev) =>
          prev.map((i) =>
            i.id === invite.id
              ? {
                  ...i,
                  status: "error",
                  error: res?.error ?? "Failed to send",
                }
              : i,
          ),
        )
      }
    } catch (err) {
      setInvites((prev) =>
        prev.map((i) =>
          i.id === invite.id
            ? {
                ...i,
                status: "error",
                error: err instanceof Error ? err.message : "Failed to send",
              }
            : i,
        ),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const hasPending = invites.some((i) => i.status !== "success")
  const allSuccessful = invites.length > 0 && !hasPending

  return (
    <form
      onSubmit={handleSubmit}
      className={cn("flex flex-col gap-5", className)}
    >
      {/* Email + Role Input Row */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="invite-email-input">Teammate Email</Label>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              <HugeiconsIcon icon={Mail01Icon} size={16} />
            </span>
            <Input
              id="invite-email-input"
              type="email"
              placeholder="colleague@example.com"
              value={emailInput}
              onChange={(e) => {
                setEmailInput(e.target.value)
                if (inputError) setInputError(null)
              }}
              onKeyDown={handleKeyDown}
              className="pl-9"
              disabled={isSubmitting}
            />
          </div>

          {/* Role selector buttons */}
          <div className="flex items-center gap-1 border border-border rounded-lg p-1 bg-muted/40">
            {allowedRoles.map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => setSelectedRole(role)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize",
                  selectedRole === role
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {role}
              </button>
            ))}
          </div>

          <Button
            type="button"
            variant="secondary"
            onClick={handleAddInvite}
            disabled={!emailInput.trim() || isSubmitting}
            className="shrink-0"
          >
            <HugeiconsIcon icon={Add01Icon} size={16} className="mr-1.5" />
            Add
          </Button>
        </div>

        {inputError && (
          <p role="alert" className="text-xs text-destructive">
            {inputError}
          </p>
        )}
      </div>

      {/* Queued Invites List */}
      {invites.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5 font-medium">
              <HugeiconsIcon icon={UserGroupIcon} size={14} />
              Recipients ({invites.length})
            </span>
            <span>
              {invites.filter((i) => i.status === "success").length} sent
            </span>
          </div>

          <ScrollArea className="max-h-48 border border-border rounded-lg p-2 bg-muted/20">
            <div className="flex flex-col gap-1.5">
              {invites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex items-center justify-between gap-3 p-2 rounded-md bg-background border border-border/60 text-sm"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {invite.status === "pending" && (
                      <span className="size-2 rounded-full bg-muted-foreground/50 shrink-0" />
                    )}
                    {invite.status === "sending" && (
                      <HugeiconsIcon
                        icon={Loading03Icon}
                        size={14}
                        className="animate-spin text-primary shrink-0"
                      />
                    )}
                    {invite.status === "success" && (
                      <HugeiconsIcon
                        icon={CheckmarkCircle01Icon}
                        size={14}
                        className="text-emerald-600 dark:text-emerald-400 shrink-0"
                      />
                    )}
                    {invite.status === "error" && (
                      <HugeiconsIcon
                        icon={AlertCircleIcon}
                        size={14}
                        className="text-destructive shrink-0"
                      />
                    )}

                    <span className="truncate font-mono text-xs">
                      {invite.email}
                    </span>
                    <Badge
                      variant="outline"
                      className="text-[10px] capitalize shrink-0"
                    >
                      {invite.role}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {invite.status === "error" && (
                      <>
                        <span className="text-[11px] text-destructive max-w-[120px] truncate hidden sm:inline">
                          {invite.error ?? "Failed"}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => handleRetryFailed(invite)}
                          title="Retry sending"
                          disabled={isSubmitting}
                        >
                          <HugeiconsIcon icon={RefreshIcon} size={12} />
                        </Button>
                      </>
                    )}

                    {invite.status !== "success" && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => handleRemoveInvite(invite.id)}
                        disabled={isSubmitting}
                        title="Remove"
                      >
                        <HugeiconsIcon icon={Cancel01Icon} size={12} />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Action Footer */}
      <div className="flex items-center justify-between gap-3 pt-2">
        {onSkip ? (
          <Button
            type="button"
            variant="ghost"
            onClick={onSkip}
            disabled={isSubmitting}
          >
            {skipLabel}
          </Button>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-2">
          {allSuccessful ? (
            <Button type="button" onClick={onComplete} className="min-w-28">
              Continue
            </Button>
          ) : (
            <Button
              type="submit"
              disabled={invites.length === 0 || isSubmitting}
              className="min-w-28"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <HugeiconsIcon
                    icon={Loading03Icon}
                    size={16}
                    className="animate-spin"
                  />
                  Sending…
                </span>
              ) : (
                submitLabel
              )}
            </Button>
          )}
        </div>
      </div>
    </form>
  )
}
