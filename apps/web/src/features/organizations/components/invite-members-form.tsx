import {
  ArrowDown01Icon,
  ArrowRight01Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  Copy01Icon,
  Link01Icon,
  Loading03Icon,
  RefreshIcon,
  Shield01Icon,
  SparklesIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
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

import { moduleLogger } from "@/lib/logger"
import type { OrganizationRole } from "../schemas"

const log = moduleLogger("organizations")

export interface QueuedInvite {
  id: string
  email: string
  role: OrganizationRole
  status: "pending" | "sending" | "success" | "error"
  error?: string
}

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

const ROLE_DESCRIPTIONS: Record<string, string> = {
  admin: "Manage workspace and people.",
  member: "Create and edit projects.",
  viewer: "Read-only access.",
  owner: "Full workspace control.",
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const isValidEmail = (email: string) => EMAIL_RE.test(email.trim())

const initials = (email: string) => {
  const namePart = email.trim().split("@")[0] ?? ""
  return namePart.slice(0, 2).toUpperCase() || "??"
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
  const [defaultRole, setDefaultRole] = React.useState<OrganizationRole>(
    defaultRoleProp ?? allowedRoles[0] ?? "member",
  )

  const [invites, setInvites] = React.useState<QueuedInvite[]>(() => {
    if (!initialEmails || initialEmails.length === 0) return []
    const seen = new Set<string>()
    const initial: QueuedInvite[] = []
    const role = defaultRoleProp ?? allowedRoles[0] ?? "member"
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
  })

  const [draft, setDraft] = React.useState("")
  const [note, setNote] = React.useState("")
  const [showMessage, setShowMessage] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [copied, setCopied] = React.useState(false)

  const containerRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const submittingRef = React.useRef(false)
  const mountedRef = React.useRef(true)
  const copyTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  )
  const invitesRef = React.useRef(invites)

  React.useEffect(() => {
    invitesRef.current = invites
  }, [invites])

  React.useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current)
      }
    }
  }, [])

  // Ensure defaultRole is among allowedRoles
  React.useEffect(() => {
    if (allowedRoles.length > 0 && !allowedRoles.includes(defaultRole)) {
      setDefaultRole(allowedRoles[0] ?? "member")
    }
  }, [allowedRoles, defaultRole])

  const isAutoJoin = React.useCallback(
    (email: string) => {
      if (!workspaceDomain) return false
      const trimmed = email.toLowerCase().trim()
      if (!isValidEmail(trimmed)) return false
      const domain = workspaceDomain.toLowerCase().replace(/^@/, "").trim()
      if (!domain) return false
      const emailDomain = trimmed.split("@")[1]
      if (!emailDomain) return false
      return emailDomain === domain || emailDomain.endsWith(`.${domain}`)
    },
    [workspaceDomain],
  )

  const stats = React.useMemo(() => {
    const valid = invites.filter((c) => isValidEmail(c.email))
    const autojoin = valid.filter((c) => isAutoJoin(c.email))
    const sendable = valid.filter(
      (c) => !isAutoJoin(c.email) && c.status !== "success",
    )
    const invalid = invites.length - valid.length
    return {
      total: invites.length,
      sendable: sendable.length,
      autojoin: autojoin.length,
      invalid,
    }
  }, [invites, isAutoJoin])

  const addEmails = React.useCallback(
    (raw: string) => {
      const parts = raw
        .split(SPLIT_RE)
        .map((s) => s.trim().replace(/^[,;]+|[,;]+$/g, ""))
        .filter(Boolean)
      if (parts.length === 0) return

      setInvites((prev) => {
        const seen = new Set(prev.map((c) => c.email.toLowerCase()))
        const next = [...prev]
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
        return next
      })
    },
    [defaultRole],
  )

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return

    if (
      e.key === "Enter" ||
      e.key === "," ||
      e.key === ";" ||
      e.key === "Tab"
    ) {
      const raw = (draft || e.currentTarget?.value || "").trim()
      if (raw.length === 0) return
      e.preventDefault()
      addEmails(raw)
      setDraft("")
      if (e.currentTarget) {
        e.currentTarget.value = ""
      }
    } else if (
      e.key === "Backspace" &&
      draft.length === 0 &&
      (!e.currentTarget?.value || e.currentTarget.value.length === 0) &&
      invites.length > 0
    ) {
      e.preventDefault()
      setInvites((prev) => prev.slice(0, -1))
    }
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData?.getData("text") ?? ""
    if (!text) return

    if (SPLIT_RE.test(text) || isValidEmail(text.trim())) {
      e.preventDefault()
      const fullText = draft.trim() ? `${draft} ${text}` : text
      addEmails(fullText)
      setDraft("")
      if (e.currentTarget) {
        e.currentTarget.value = ""
      }
    }
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const raw = (draft || e.currentTarget?.value || "").trim()
    if (raw.length === 0) return
    addEmails(raw)
    setDraft("")
    if (e.currentTarget) {
      e.currentTarget.value = ""
    }
  }

  const handleContainerMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    if (!target.closest("button, [role='button'], [data-role='trigger']")) {
      e.preventDefault()
      inputRef.current?.focus()
    }
  }

  const handleRemoveInvite = (id: string) => {
    setInvites((prev) => prev.filter((i) => i.id !== id))
  }

  const handleChangeRole = (id: string, role: OrganizationRole) => {
    setInvites((prev) => prev.map((i) => (i.id === id ? { ...i, role } : i)))
  }

  const displayLink = React.useMemo(() => {
    if (inviteLink) {
      return inviteLink.replace(/^https?:\/\//, "")
    }
    const shortId = organizationId ? organizationId.slice(0, 8) : "join"
    if (typeof window !== "undefined" && window.location?.host) {
      return `${window.location.host}/invite/${shortId}`
    }
    return `fenr.app/invite/${shortId}`
  }, [inviteLink, organizationId])

  const handleCopyLink = React.useCallback(async () => {
    try {
      const fullUrl = inviteLink
        ? inviteLink
        : typeof window !== "undefined" && window.location?.origin
          ? `${window.location.origin}/invite/${organizationId ?? "join"}`
          : `https://fenr.app/invite/${organizationId ?? "join"}`
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(fullUrl)
        if (!mountedRef.current) return
        setCopied(true)
        toast.success("Invite link copied to clipboard")
        if (copyTimeoutRef.current) {
          clearTimeout(copyTimeoutRef.current)
        }
        copyTimeoutRef.current = setTimeout(() => {
          if (mountedRef.current) {
            setCopied(false)
          }
        }, 1500)
      } else {
        toast.error("Clipboard access not available")
      }
    } catch (err) {
      log.error({ err }, "Failed to copy invite link")
      toast.error("Failed to copy link to clipboard")
    }
  }, [inviteLink, organizationId])

  const canContinueWithoutSending = React.useMemo(() => {
    return (
      stats.sendable === 0 &&
      stats.invalid === 0 &&
      invites.length > 0 &&
      invites.every((i) => isAutoJoin(i.email) || i.status === "success")
    )
  }, [stats.sendable, stats.invalid, invites, isAutoJoin])

  const handleRetryFailed = async (invite: QueuedInvite) => {
    if (submittingRef.current || isSubmitting) return
    submittingRef.current = true
    setIsSubmitting(true)
    setInvites((prev) =>
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
        setInvites((prev) =>
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
        if (sendableRemaining.length === 0) {
          onComplete?.()
        }
      } else {
        const errorMsg = res?.error || "Failed to send invitation"
        toast.error(`Failed to send invitation to ${invite.email}`, {
          description: errorMsg,
        })
        setInvites((prev) =>
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
    } catch (err) {
      log.error({ err, inviteId: invite.id }, "Failed to retry invitation")
      if (!mountedRef.current) return
      const message = "Failed to send invitation. Please try again."
      toast.error(message)
      setInvites((prev) =>
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
      if (mountedRef.current) {
        setIsSubmitting(false)
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submittingRef.current || isSubmitting) return

    let currentInvites = invites
    const trimmed = draft.trim()
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
        setInvites(currentInvites)
        setDraft("")
      }
    }

    const pendingInvites = currentInvites.filter(
      (i) =>
        isValidEmail(i.email) && !isAutoJoin(i.email) && i.status !== "success",
    )

    if (pendingInvites.length === 0) {
      if (canContinueWithoutSending) {
        if (currentInvites.every((i) => isAutoJoin(i.email))) {
          toast.info("All members have auto-join enabled", {
            description: "No invitation emails needed for this domain.",
          })
        }
        onComplete?.()
        return
      }
      toast.info("No invitations to send", {
        description: "Add one or more valid email addresses first.",
      })
      return
    }

    submittingRef.current = true
    setIsSubmitting(true)
    setInvites(
      currentInvites.map((i) =>
        pendingInvites.some((p) => p.id === i.id)
          ? { ...i, status: "sending", error: undefined }
          : i,
      ),
    )

    const payload = pendingInvites.map((i) => ({
      email: i.email,
      role: i.role,
      ...(note.trim() ? { note: note.trim() } : {}),
    }))

    try {
      const results = await onInvite(payload)
      if (!mountedRef.current) return

      setInvites((prev) =>
        prev.map((item) => {
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
            status: res.success ? "success" : "error",
            error: res.error,
          }
        }),
      )

      const successCount = results.filter((r) => r.success).length
      const failureCount = payload.length - successCount

      if (failureCount === 0 && successCount > 0) {
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
      log.error({ err, count: payload.length }, "Failed to send invitations")
      const message = "Could not send invitations. Please try again."
      toast.error("Invitation error", { description: message })
      if (!mountedRef.current) return
      setInvites((prev) =>
        prev.map((i) =>
          i.status === "sending"
            ? { ...i, status: "error", error: message }
            : i,
        ),
      )
    } finally {
      submittingRef.current = false
      if (mountedRef.current) {
        setIsSubmitting(false)
      }
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn("flex flex-col gap-5", className)}
    >
      {/* Header Row: Label & Default Role Selector */}
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="invite-email-input" className="font-medium text-sm">
          Invitees
        </Label>
        <div className="flex items-center gap-2">
          <span className="hidden font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em] sm:inline">
            Default role
          </span>
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
                    onClick={() => setDefaultRole(r)}
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
          <div className="flex flex-wrap items-center gap-1.5 p-0.5">
            {invites.map((invite) => (
              <ChipPill
                key={invite.id}
                invite={invite}
                allowedRoles={allowedRoles}
                isSubmitting={isSubmitting}
                isAutoJoin={isAutoJoin(invite.email)}
                defaultOpenRole={defaultOpenRoleForEmail === invite.email}
                onRemove={() => handleRemoveInvite(invite.id)}
                onRoleChange={(newRole) => handleChangeRole(invite.id, newRole)}
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
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              onBlur={handleBlur}
              placeholder={
                invites.length === 0
                  ? "name@example.com, another@example.com…"
                  : "Add another…"
              }
              className="min-w-[14ch] flex-1 bg-transparent px-1.5 py-1 text-sm outline-none placeholder:text-muted-foreground"
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
        className="flex items-center gap-3 font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em]"
      >
        <span>
          <span className="text-foreground font-semibold">
            {stats.sendable}
          </span>{" "}
          to invite
        </span>
        {stats.autojoin > 0 && (
          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
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
              onClick={() => setShowMessage(false)}
              disabled={isSubmitting}
              className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em] hover:text-foreground transition-colors cursor-pointer disabled:pointer-events-none"
            >
              Hide
            </button>
          </div>
          <Textarea
            id="invite-personal-note"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a quick hello so they know what they're joining."
            disabled={isSubmitting}
            className="resize-none text-xs"
          />
        </div>
      ) : (
        <div>
          <button
            type="button"
            onClick={() => setShowMessage(true)}
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
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-border/60 pt-4">
        <div className="flex items-center">
          <button
            type="button"
            onClick={handleCopyLink}
            data-testid="copy-link-btn"
            className="group inline-flex items-center gap-2 rounded-md border border-dashed border-border/60 px-2.5 py-1.5 font-mono text-[11px] text-muted-foreground transition-colors hover:border-border hover:text-foreground cursor-pointer"
          >
            <HugeiconsIcon
              icon={copied ? CheckmarkCircle02Icon : Link01Icon}
              size={14}
              className={cn(
                "shrink-0 transition-colors",
                copied
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "opacity-60 group-hover:opacity-100",
              )}
            />
            <span className="truncate max-w-[130px] sm:max-w-[190px]">
              {displayLink}
            </span>
            <span className="flex items-center gap-1 opacity-60 group-hover:opacity-100 shrink-0">
              <HugeiconsIcon icon={Copy01Icon} size={12} />
              <span className="uppercase tracking-[0.2em]">
                {copied ? "Copied" : "Copy link"}
              </span>
            </span>
          </button>
        </div>

        <div className="flex items-center justify-end gap-2">
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
        className="rounded-lg border border-border/60 bg-muted/20 px-4 py-3 text-sm"
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

export function ChipPill({
  invite,
  allowedRoles,
  isSubmitting,
  isAutoJoin,
  defaultOpenRole = false,
  onRemove,
  onRoleChange,
  onRetry,
}: {
  invite: QueuedInvite
  allowedRoles: OrganizationRole[]
  isSubmitting: boolean
  isAutoJoin: boolean
  defaultOpenRole?: boolean
  onRemove: () => void
  onRoleChange: (role: OrganizationRole) => void
  onRetry?: () => void
}) {
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
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-300"
            : !valid
              ? "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-300"
              : "border-border bg-foreground/[0.04] text-foreground",
      )}
    >
      {/* 2-char initials pill */}
      <span
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full font-mono text-[9px] uppercase",
          autoJoinActive
            ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-semibold"
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
          className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[9px] text-emerald-700 font-medium uppercase tracking-[0.18em] dark:text-emerald-400"
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
          className="text-emerald-600 dark:text-emerald-400 shrink-0"
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
