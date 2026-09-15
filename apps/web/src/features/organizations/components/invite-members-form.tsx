import {
  ArrowDown01Icon,
  ArrowRight01Icon,
  CheckmarkCircle02Icon,
  Loading03Icon,
  Shield01Icon,
  SparklesIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useForm, useStore } from "@tanstack/react-form"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Label } from "@workspace/ui/components/label"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import { Textarea } from "@workspace/ui/components/textarea"
import { cn } from "@workspace/ui/lib/utils"
import * as React from "react"
import { toast } from "sonner"

import {
  type InviteMembersFormValues,
  inviteMembersFormSchema,
  type OrganizationRole,
} from "@/lib/schemas/organizations"
import { useInviteChips } from "../hooks/use-invite-chips"
import {
  ChipPill,
  isValidEmail,
  type QueuedInvite,
  ROLE_DESCRIPTIONS,
} from "./invite-chip"
import { InviteLinkBar } from "./invite-link-bar"

export type { QueuedInvite }
export { ChipPill }

export interface InviteMembersFormProps {
  organizationId?: string
  workspaceDomain?: string
  inviteLink?: string
  initialEmails?: string[]
  onInvite: (
    invites: Array<{ email: string; role: OrganizationRole; note?: string }>,
  ) => Promise<Array<{ email: string; success: boolean; error?: string }>>
  onComplete?: () => void
  onSkip?: () => void
  skipLabel?: string
  submitLabel?: string
  className?: string
  allowedRoles?: OrganizationRole[]
  defaultRole?: OrganizationRole
  defaultOpenRoleForEmail?: string
}

const SPLIT_RE = /[\s,;]+/

export function InviteMembersForm({
  organizationId,
  workspaceDomain,
  inviteLink,
  initialEmails,
  onInvite,
  onComplete,
  onSkip,
  skipLabel = "Skip for now",
  submitLabel = "Send Invitations",
  className,
  allowedRoles = ["member", "admin"],
  defaultRole: defaultRoleProp,
  defaultOpenRoleForEmail,
}: InviteMembersFormProps) {
  const initialRole = defaultRoleProp ?? allowedRoles[0] ?? "member"
  const initialInvites = React.useMemo<QueuedInvite[]>(() => {
    if (!initialEmails || initialEmails.length === 0) return []
    const seen = new Set<string>()
    const initial: QueuedInvite[] = []
    const role = initialRole
    for (const raw of initialEmails) {
      const email = raw.trim().toLowerCase()
      if (!email || seen.has(email)) continue
      seen.add(email)
      initial.push({
        id: crypto.randomUUID(),
        email,
        role,
        status: "pending",
      })
    }
    return initial
  }, [initialEmails, initialRole])

  const submittingRef = React.useRef(false)
  const mountedRef = React.useRef(true)
  const invitesRef = React.useRef(initialInvites)

  const form = useForm({
    defaultValues: {
      invites: initialInvites,
      draft: "",
      note: "",
      showMessage: false,
      defaultRole: initialRole,
    },
    validators: { onSubmit: inviteMembersFormSchema },
    onSubmit: async ({ value }) => {
      await submitInvites(value)
    },
    onSubmitInvalid: () => {
      toast.error("Review the invitation form", {
        description:
          "Correct the highlighted invitation details and try again.",
      })
    },
  })

  const invites = useStore(form.store, (state) => state.values.invites)
  const draft = useStore(form.store, (state) => state.values.draft)
  const note = useStore(form.store, (state) => state.values.note)
  const defaultRole = useStore(form.store, (state) => state.values.defaultRole)
  const showMessage = useStore(form.store, (state) => state.values.showMessage)
  const isSubmitting = useStore(form.store, (state) => state.isSubmitting)

  React.useEffect(() => {
    invitesRef.current = invites
  }, [invites])

  React.useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  // Ensure defaultRole is among allowedRoles
  React.useEffect(() => {
    if (allowedRoles.length > 0 && !allowedRoles.includes(defaultRole)) {
      form.setFieldValue("defaultRole", allowedRoles[0] ?? "member")
    }
  }, [allowedRoles, defaultRole, form])

  const {
    inputRef,
    containerRef,
    stats,
    isAutoJoin,
    handleKeyDown,
    handlePaste,
    handleBlur,
    handleContainerMouseDown,
    removeInvite,
    changeRole,
  } = useInviteChips({
    invites,
    setInvites: (updater) => form.setFieldValue("invites", updater),
    draft,
    setDraft: (value) => form.setFieldValue("draft", value),
    defaultRole,
    workspaceDomain,
  })

  const canContinueWithoutSending = React.useMemo(() => {
    return (
      stats.sendable === 0 &&
      stats.invalid === 0 &&
      invites.length > 0 &&
      invites.every((i) => isAutoJoin(i.email) || i.status === "success")
    )
  }, [stats.sendable, stats.invalid, invites, isAutoJoin])

  const handleRetryFailed = async (invite: QueuedInvite) => {
    if (submittingRef.current) return
    submittingRef.current = true
    form.setFieldValue("invites", (prev) =>
      prev.map((i) =>
        i.id === invite.id ? { ...i, status: "sending", error: undefined } : i,
      ),
    )

    try {
      const results = await onInvite([
        {
          email: invite.email,
          role: invite.role,
          ...(note.trim() ? { note: note.trim() } : {}),
        },
      ])
      if (!mountedRef.current) return
      const res = results[0]
      if (res?.success) {
        toast.success(`Invitation sent to ${invite.email}`)
        const currentList = invitesRef.current
        const next = currentList.map((i) =>
          i.id === invite.id
            ? { ...i, status: "success" as const, error: undefined }
            : i,
        )
        invitesRef.current = next
        form.setFieldValue("invites", (prev) =>
          prev.map((i) =>
            i.id === invite.id
              ? { ...i, status: "success" as const, error: undefined }
              : i,
          ),
        )

        const sendableRemaining = next.filter(
          (i) =>
            isValidEmail(i.email) &&
            !isAutoJoin(i.email) &&
            i.status !== "success",
        )
        const hasInvalidInvites = next.some((i) => !isValidEmail(i.email))
        if (sendableRemaining.length === 0 && !hasInvalidInvites) {
          onComplete?.()
        }
      } else {
        const errorMsg = res?.error || "Failed to send invitation"
        toast.error(`Failed to send invitation to ${invite.email}`, {
          description: errorMsg,
        })
        form.setFieldValue("invites", (prev) =>
          prev.map((i) =>
            i.id === invite.id
              ? {
                  ...i,
                  status: "error",
                  error: errorMsg,
                }
              : i,
          ),
        )
      }
    } catch {
      if (!mountedRef.current) return
      const message = "Failed to send invitation. Please try again."
      toast.error(message)
      form.setFieldValue("invites", (prev) =>
        prev.map((i) =>
          i.id === invite.id
            ? {
                ...i,
                status: "error",
                error: message,
              }
            : i,
        ),
      )
    } finally {
      submittingRef.current = false
    }
  }

  async function submitInvites(values: InviteMembersFormValues) {
    if (submittingRef.current) return

    let currentInvites = values.invites
    const trimmed = values.draft.trim()
    if (trimmed) {
      const parts = trimmed
        .split(SPLIT_RE)
        .map((s) => s.trim().replace(/^[,;]+|[,;]+$/g, ""))
        .filter(Boolean)
      if (parts.length > 0) {
        const seen = new Set(currentInvites.map((c) => c.email.toLowerCase()))
        const next = [...currentInvites]
        for (const email of parts) {
          const key = email.toLowerCase()
          if (seen.has(key)) continue
          seen.add(key)
          next.push({
            id: crypto.randomUUID(),
            email: key,
            role: defaultRole,
            status: "pending",
          })
        }
        currentInvites = next
        form.setFieldValue("invites", currentInvites)
        form.setFieldValue("draft", "")
      }
    }

    const hasInvalidInvites = currentInvites.some(
      (invite) => !isValidEmail(invite.email),
    )
    if (hasInvalidInvites) {
      toast.info("Review invalid invitations", {
        description:
          "Remove or correct invalid email addresses before continuing.",
      })
      return
    }

    const pendingInvites = currentInvites.filter(
      (i) =>
        isValidEmail(i.email) && !isAutoJoin(i.email) && i.status !== "success",
    )

    if (pendingInvites.length === 0) {
      if (
        currentInvites.length > 0 &&
        currentInvites.every(
          (invite) => isAutoJoin(invite.email) || invite.status === "success",
        )
      ) {
        if (currentInvites.every((i) => isAutoJoin(i.email))) {
          toast.info("All members have auto-join enabled", {
            description: "No invitation emails needed for this domain.",
          })
        }
        onComplete?.()
        return
      }
      toast.info(
        hasInvalidInvites
          ? "Review invalid invitations"
          : "No invitations to send",
        {
          description: hasInvalidInvites
            ? "Remove or correct invalid email addresses before continuing."
            : "Add one or more valid email addresses first.",
        },
      )
      return
    }

    submittingRef.current = true
    form.setFieldValue(
      "invites",
      currentInvites.map((i) =>
        pendingInvites.some((p) => p.id === i.id)
          ? { ...i, status: "sending", error: undefined }
          : i,
      ),
    )

    const payload = pendingInvites.map((i) => ({
      email: i.email,
      role: i.role,
      ...(values.note.trim() ? { note: values.note.trim() } : {}),
    }))

    try {
      const results = await onInvite(payload)
      if (!mountedRef.current) return

      const nextInvites: InviteMembersFormValues["invites"] =
        currentInvites.map((item) => {
          const res = results.find(
            (r) => r.email.toLowerCase() === item.email.toLowerCase(),
          )
          if (!res) {
            return item.status === "sending"
              ? { ...item, status: "error", error: "No response received" }
              : item
          }
          return {
            ...item,
            status: res.success ? ("success" as const) : ("error" as const),
            error: res.error,
          }
        })
      form.setFieldValue("invites", nextInvites)

      const successCount = results.filter((r) => r.success).length
      const failureCount = payload.length - successCount

      const hasInvalidInvites = nextInvites.some(
        (invite) => !isValidEmail(invite.email),
      )
      const hasPendingSendable = nextInvites.some(
        (invite) =>
          isValidEmail(invite.email) &&
          !isAutoJoin(invite.email) &&
          invite.status !== "success",
      )

      if (
        failureCount === 0 &&
        successCount > 0 &&
        !hasInvalidInvites &&
        !hasPendingSendable
      ) {
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
    } catch {
      const message = "Could not send invitations. Please try again."
      toast.error("Invitation error", { description: message })
      if (!mountedRef.current) return
      form.setFieldValue("invites", (prev) =>
        prev.map((i) =>
          i.status === "sending"
            ? { ...i, status: "error", error: message }
            : i,
        ),
      )
    } finally {
      submittingRef.current = false
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        void form.handleSubmit()
      }}
      className={cn("flex flex-col gap-4", className)}
      noValidate
    >
      {/* Recipient Header with Default Role Dropdown */}
      <div className="flex items-center justify-between">
        <Label
          htmlFor="invite-email-input"
          className="font-medium text-xs text-foreground select-none"
        >
          Invitees
        </Label>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>as</span>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isSubmitting}
                  className="h-8 gap-1.5 font-mono text-xs capitalize"
                  aria-label="Default role"
                  data-testid="default-role-trigger"
                >
                  <span>{defaultRole}</span>
                  <HugeiconsIcon icon={ArrowDown01Icon} size={12} />
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-56 p-1">
              {allowedRoles.map((r) => {
                const active = r === defaultRole
                return (
                  <DropdownMenuItem
                    key={r}
                    onClick={() => form.setFieldValue("defaultRole", r)}
                    data-testid={`default-role-option-${r}`}
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
                      <span className="font-medium text-xs capitalize">
                        {r}
                      </span>
                      <span className="text-muted-foreground text-[11px] leading-tight normal-case">
                        {ROLE_DESCRIPTIONS[r] ?? `${r} role`}
                      </span>
                    </div>
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Interactive Chip / Tag Container */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: Clicking container focuses input */}
      <div
        ref={containerRef}
        onMouseDown={handleContainerMouseDown}
        className={cn(
          "min-h-[46px] w-full cursor-text rounded-lg border border-input bg-background p-1.5 text-left transition-all",
          "focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
        )}
      >
        <ScrollArea className="max-h-48 w-full">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5 p-0.5">
            {invites.map((invite) => (
              <ChipPill
                key={invite.id}
                invite={invite}
                allowedRoles={allowedRoles}
                isSubmitting={isSubmitting}
                isAutoJoin={isAutoJoin(invite.email)}
                defaultOpenRole={defaultOpenRoleForEmail === invite.email}
                onRemove={() => removeInvite(invite.id)}
                onRoleChange={(newRole) => changeRole(invite.id, newRole)}
                onRetry={() => handleRetryFailed(invite)}
              />
            ))}

            <input
              ref={inputRef}
              id="invite-email-input"
              data-testid="invite-email-input"
              aria-label="Recipient email addresses"
              type="text"
              value={draft}
              onChange={(e) => form.setFieldValue("draft", e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              onBlur={handleBlur}
              placeholder={
                invites.length === 0
                  ? "name@example.com, another@example.com…"
                  : "Add another…"
              }
              className="min-w-[8ch] max-w-full flex-[1_1_8ch] bg-transparent px-1.5 py-1 text-sm outline-none placeholder:text-muted-foreground"
              disabled={isSubmitting}
            />
          </div>
        </ScrollArea>
      </div>

      {/* Live Stats Counter */}
      <div
        data-testid="stats-counter"
        role="status"
        aria-live="polite"
        className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em]"
      >
        <span>
          <span className="text-foreground font-semibold">
            {stats.sendable}
          </span>{" "}
          to invite
        </span>
        {stats.autojoin > 0 && (
          <span className="flex items-center gap-1 text-foreground">
            <HugeiconsIcon icon={SparklesIcon} size={12} />
            <span>{stats.autojoin} auto-join</span>
          </span>
        )}
        {stats.invalid > 0 && (
          <span className="text-destructive font-semibold">
            {stats.invalid} invalid
          </span>
        )}
      </div>

      {/* Expandable Personal Note */}
      {showMessage ? (
        <div
          id="personal-note-section"
          className="flex flex-col gap-1.5"
          data-testid="personal-note-section"
        >
          <div className="flex items-center justify-between">
            <Label
              htmlFor="invite-personal-note"
              className="font-medium text-xs text-muted-foreground"
            >
              Personal note
            </Label>
            <button
              type="button"
              onClick={() => {
                form.setFieldValue("showMessage", false)
                form.setFieldValue("note", "")
              }}
              disabled={isSubmitting}
              className="font-mono text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              Hide
            </button>
          </div>
          <Textarea
            id="invite-personal-note"
            rows={3}
            value={note}
            onChange={(e) => form.setFieldValue("note", e.target.value)}
            placeholder="Add a quick hello so they know what they're joining."
            disabled={isSubmitting}
            className="resize-none text-xs"
          />
        </div>
      ) : (
        <div>
          <button
            type="button"
            onClick={() => form.setFieldValue("showMessage", true)}
            disabled={isSubmitting}
            aria-expanded={false}
            aria-controls="personal-note-section"
            data-testid="personal-note-toggle"
            className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em] hover:text-foreground transition-colors cursor-pointer disabled:pointer-events-none"
          >
            + Add a personal note
          </button>
        </div>
      )}

      {/* Action Footer */}
      <div className="flex min-w-0 flex-col items-stretch justify-between gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center">
        <InviteLinkBar
          inviteLink={inviteLink}
          organizationId={organizationId}
          isSubmitting={isSubmitting}
        />

        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
          {onSkip && (
            <Button
              type="button"
              variant="ghost"
              onClick={onSkip}
              disabled={isSubmitting}
              data-testid="skip-invites-btn"
            >
              {skipLabel}
            </Button>
          )}
          <Button
            type="submit"
            disabled={
              isSubmitting ||
              (!canContinueWithoutSending &&
                stats.sendable === 0 &&
                !draft.trim())
            }
            data-testid="submit-invites-btn"
            className="min-w-28 gap-2"
          >
            {isSubmitting ? (
              <>
                <HugeiconsIcon
                  icon={Loading03Icon}
                  size={16}
                  className="animate-spin"
                />
                <span>Sending…</span>
              </>
            ) : (
              <>
                <span>
                  {stats.sendable > 0
                    ? `Send ${stats.sendable} invite${stats.sendable === 1 ? "" : "s"}`
                    : canContinueWithoutSending
                      ? "Continue"
                      : submitLabel}
                </span>
                <HugeiconsIcon icon={ArrowRight01Icon} size={16} />
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Domain Auto-Join Info Banner */}
      <div
        data-testid="domain-info-banner"
        className="min-w-0 rounded-lg border border-border/60 bg-muted/20 px-4 py-3 text-sm"
      >
        <div className="flex items-start gap-3">
          <HugeiconsIcon
            icon={Shield01Icon}
            size={16}
            className="mt-0.5 shrink-0 text-muted-foreground opacity-70"
          />
          <div className="flex-1">
            {workspaceDomain ? (
              <>
                <div className="font-medium text-foreground">
                  Domain auto-join is on
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                  Anyone with an{" "}
                  <span className="font-mono text-foreground font-semibold">
                    @{workspaceDomain.replace(/^@/, "").trim()}
                  </span>{" "}
                  email joins automatically — no invite needed.
                </p>
              </>
            ) : (
              <>
                <div className="font-medium text-foreground">
                  Workspace invitations
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                  Invited teammates will receive an email with instructions to
                  join your organization. Links expire after 7 days.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </form>
  )
}
