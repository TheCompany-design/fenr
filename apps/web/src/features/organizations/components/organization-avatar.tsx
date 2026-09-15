import { cn } from "@workspace/ui/lib/utils"
import * as React from "react"

export interface OrganizationAvatarProps {
  name?: string | null
  slug?: string | null
  logo?: string | null
  size?: "xs" | "sm" | "md" | "lg" | "xl"
  className?: string
}

const sizeClasses = {
  xs: "size-6 text-xs rounded-md",
  sm: "size-8 text-sm rounded-md",
  md: "size-10 text-base rounded-lg",
  lg: "size-12 text-lg rounded-lg",
  xl: "size-16 text-xl rounded-xl",
} as const

export function OrganizationAvatar({
  name,
  slug,
  logo,
  size = "md",
  className,
}: OrganizationAvatarProps) {
  const [failedLogo, setFailedLogo] = React.useState<string | null>(null)

  const displayName = name?.trim() || slug?.trim() || "Organization"
  const rawInitial = name?.trim() || slug?.trim() || "?"
  const initial = (Array.from(rawInitial)[0] ?? "?").toUpperCase()

  const hasImage = Boolean(logo) && failedLogo !== logo

  return (
    <div
      role="img"
      aria-label={displayName}
      className={cn(
        "relative flex shrink-0 items-center justify-center font-semibold select-none overflow-hidden",
        "bg-primary/10 text-primary border border-border/50",
        sizeClasses[size],
        className,
      )}
    >
      {hasImage ? (
        <img
          src={logo ?? undefined}
          alt={displayName}
          className="size-full object-cover"
          onError={() => setFailedLogo(logo ?? null)}
        />
      ) : (
        <span aria-hidden="true">{initial}</span>
      )}
    </div>
  )
}
