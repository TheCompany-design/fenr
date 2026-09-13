/**
 * AuthErrorBanner — accessible alert banner for authentication errors.
 *
 * Displays error explanations (such as expired session, invalid magic link token,
 * or access resolution failures) using semantic design tokens.
 */
import { AlertCircleIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { getAuthErrorMessage } from "../utils/error-messages"

export interface AuthErrorBannerProps {
  error?: string | null
  title?: string
  description?: string
  className?: string
}

export function AuthErrorBanner({
  error,
  title: customTitle,
  description: customDescription,
  className = "mb-6",
}: AuthErrorBannerProps) {
  if (!error && !customTitle) {
    return null
  }

  const mapped = getAuthErrorMessage(error)
  const title = customTitle || mapped.title
  const description = customDescription || mapped.description

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-destructive text-sm ${className}`}
    >
      <HugeiconsIcon
        icon={AlertCircleIcon}
        className="mt-0.5 size-5 shrink-0"
      />
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-1 text-muted-foreground text-xs leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  )
}
