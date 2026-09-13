/**
 * Check-email screen rebuilt from devl.dev reference block.
 *
 * Implements:
 * - Hugeicons CheckmarkCircle02Icon with semantic design tokens
 * - Wall-clock based resend cooldown timer immune to tab throttling
 * - Concurrency lock preventing double-click / rapid resubmit races
 * - Unmounted component state guards
 * - Resend count tracking badge
 * - "Open mail app" deeplink
 * - Magic link expiration or invalidity error recovery
 * - Accessible error and status regions
 * - Single-page router navigation via TanStack Router <Link>
 */
import {
  ArrowLeft01Icon,
  CheckmarkCircle02Icon,
  Mail01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Link } from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { authClient } from "@/lib/auth-client"
import { moduleLogger } from "@/lib/logger"
import { AuthErrorBanner } from "./auth-error-banner"

const log = moduleLogger("auth")

const RESEND_COOLDOWN_SECONDS = 60

export interface CheckEmailCardProps {
  email: string
  redirectTo?: string
  errorReason?: string | null
}

export function CheckEmailCard({
  email,
  redirectTo = "/",
  errorReason,
}: CheckEmailCardProps) {
  const [cooldownEnd, setCooldownEnd] = useState<number | null>(() =>
    errorReason ? null : Date.now() + RESEND_COOLDOWN_SECONDS * 1000,
  )
  const [secondsLeft, setSecondsLeft] = useState(() =>
    errorReason ? 0 : RESEND_COOLDOWN_SECONDS,
  )
  const [resendCount, setResendCount] = useState(0)
  const [resending, setResending] = useState(false)

  const isResendingRef = useRef(false)
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!cooldownEnd) {
      setSecondsLeft(0)
      return
    }

    const updateRemaining = () => {
      const remaining = Math.max(
        0,
        Math.ceil((cooldownEnd - Date.now()) / 1000),
      )
      setSecondsLeft(remaining)
      if (remaining <= 0) {
        setCooldownEnd(null)
      }
    }

    updateRemaining()
    const timer = window.setInterval(updateRemaining, 500)
    return () => window.clearInterval(timer)
  }, [cooldownEnd])

  const handleResend = async () => {
    const trimmedEmail = email ? email.trim() : ""
    if (!trimmedEmail) {
      toast.error("Email required", {
        description: "Please return to sign in to enter your email address.",
      })
      return
    }

    if (secondsLeft > 0 || isResendingRef.current || resending) {
      return
    }

    isResendingRef.current = true
    setResending(true)

    try {
      const result = await authClient.signIn.magicLink({
        email: trimmedEmail,
        callbackURL: redirectTo || "/",
      })

      if (!isMountedRef.current) return

      if (result.error) {
        log.error(
          { err: result.error, email: trimmedEmail },
          "Failed to resend magic link",
        )
        toast.error("Failed to resend magic link", {
          description: "Please try again shortly.",
        })
        return
      }

      setResendCount((c) => c + 1)
      setCooldownEnd(Date.now() + RESEND_COOLDOWN_SECONDS * 1000)
      toast.success("Magic link resent", {
        description: "A fresh sign-in link has been sent to your email.",
      })
    } catch (err) {
      log.error(
        { err, email: trimmedEmail },
        "Network error occurred while resending magic link",
      )
      if (!isMountedRef.current) return
      toast.error("Network error", {
        description:
          "Unable to reach the authentication service. Please check your connection and try again.",
      })
    } finally {
      isResendingRef.current = false
      if (isMountedRef.current) {
        setResending(false)
      }
    }
  }

  const handleOpenMailApp = () => {
    window.location.href = "mailto:"
  }

  return (
    <div className="w-full max-w-lg">
      {/* Error recovery notice if previous magic link was expired or invalid */}
      {errorReason ? <AuthErrorBanner error={errorReason} /> : null}

      <div className="inline-flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
        <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-5" />
      </div>

      <div className="mt-5 font-mono text-[11px] text-muted-foreground uppercase tracking-[0.3em]">
        {errorReason && resendCount === 0
          ? "Link expired or invalid"
          : "Magic link sent"}
      </div>
      <h1 className="mt-2 font-heading text-3xl leading-tight">
        {errorReason && resendCount === 0
          ? "Request a new link."
          : "Check your inbox."}
      </h1>
      <p className="mt-2 max-w-md text-muted-foreground text-sm leading-relaxed">
        {errorReason && resendCount === 0 ? (
          <>
            Your previous sign-in link is no longer valid. Request a fresh link
            for <span className="font-medium text-foreground">{email}</span> to
            continue.
          </>
        ) : (
          <>
            We sent a sign-in link to{" "}
            <span className="font-medium text-foreground">{email}</span>. Click
            it to continue — the link expires in{" "}
            <span className="text-foreground">10 minutes</span>.
          </>
        )}
      </p>

      <div className="mt-7 flex flex-col gap-2.5">
        <Button
          size="lg"
          type="button"
          onClick={handleOpenMailApp}
          className="gap-2"
        >
          <HugeiconsIcon icon={Mail01Icon} className="size-4" />
          Open mail app
        </Button>
        <Button
          size="lg"
          variant="outline"
          type="button"
          disabled={secondsLeft > 0 || resending}
          onClick={handleResend}
        >
          {resending
            ? "Sending…"
            : secondsLeft > 0
              ? `Resend link in ${String(secondsLeft).padStart(2, "0")}s`
              : "Resend link"}
        </Button>
      </div>

      {resendCount > 0 && (
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1 font-mono text-[10px] text-primary uppercase tracking-[0.25em]">
          <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-3" />
          Sent again · {resendCount}
        </div>
      )}

      <div className="mt-8 border-border/60 border-t pt-5">
        <Link
          to="/auth/sign-in"
          search={
            redirectTo && redirectTo !== "/"
              ? { redirect: redirectTo }
              : undefined
          }
          className="inline-flex items-center gap-1.5 text-muted-foreground text-sm transition-colors hover:text-foreground"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} className="size-3.5" />
          Use a different email
        </Link>
        <p className="mt-3 text-muted-foreground text-xs leading-relaxed">
          Didn't get the email? Check your spam folder, or try requesting
          another link above.
        </p>
      </div>
    </div>
  )
}
