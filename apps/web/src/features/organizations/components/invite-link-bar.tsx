import { Copy01Icon, Link01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "@workspace/ui/lib/utils"
import * as React from "react"
import { toast } from "sonner"

export interface InviteLinkBarProps {
  inviteLink?: string
  organizationId?: string
  isSubmitting?: boolean
}

export function InviteLinkBar({
  inviteLink,
  organizationId,
  isSubmitting = false,
}: InviteLinkBarProps) {
  const [copied, setCopied] = React.useState(false)
  const copyTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  )
  const mountedRef = React.useRef(true)

  React.useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current)
      }
    }
  }, [])

  const defaultLink = React.useMemo(() => {
    if (inviteLink) return inviteLink
    if (typeof window !== "undefined") {
      const origin = window.location.origin
      return organizationId
        ? `${origin}/invitations/accept?orgId=${organizationId}`
        : `${origin}/invitations/accept`
    }
    return "/invitations/accept"
  }, [inviteLink, organizationId])

  const displayLink = React.useMemo(() => {
    try {
      const url = new URL(
        defaultLink,
        typeof window !== "undefined"
          ? window.location.origin
          : "https://fenr.dev",
      )
      return `${url.hostname}${url.pathname}`
    } catch {
      return defaultLink
    }
  }, [defaultLink])

  const handleCopyLink = React.useCallback(async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(defaultLink)
        if (!mountedRef.current) return
        setCopied(true)
        toast.success("Invite link copied to clipboard")
        if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
        copyTimeoutRef.current = setTimeout(() => {
          if (mountedRef.current) {
            setCopied(false)
          }
        }, 1500)
      } else {
        toast.error("Clipboard access not available")
      }
    } catch {
      toast.error("Failed to copy link to clipboard")
    }
  }, [defaultLink])

  return (
    <div className="flex min-w-0 items-center">
      <button
        type="button"
        onClick={handleCopyLink}
        disabled={isSubmitting}
        aria-label={
          copied
            ? "Invite link copied to clipboard"
            : "Copy workspace invite link"
        }
        data-testid="copy-link-btn"
        className={cn(
          "group flex h-8 items-center gap-2 rounded-md border border-border/80 bg-background px-2.5 font-mono text-xs text-muted-foreground transition-all hover:border-foreground/40 hover:text-foreground active:scale-[0.98] select-none cursor-pointer",
          copied && "border-foreground/40 text-foreground bg-muted/40",
        )}
      >
        <HugeiconsIcon
          icon={Link01Icon}
          size={13}
          className={cn(
            "shrink-0 transition-colors",
            copied ? "text-foreground" : "opacity-60 group-hover:opacity-100",
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
  )
}
