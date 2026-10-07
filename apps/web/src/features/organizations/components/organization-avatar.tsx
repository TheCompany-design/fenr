import { cn } from "@workspace/ui/lib/utils"
import * as React from "react"

export interface OrganizationAvatarProps {
  name?: string | null
  slug?: string | null
  logo?: string | null
  size?: "xs" | "sm" | "md" | "lg" | "xl"
  /** `circle` is the workspace-picker look; the default keeps the softer squircle. */
  shape?: "rounded" | "circle"
  className?: string
}

const sizeClasses = {
  xs: "size-6 text-xs",
  sm: "size-8 text-sm",
  md: "size-10 text-base",
  lg: "size-12 text-lg",
  xl: "size-16 text-xl",
} as const

const roundedShapeClasses = {
  xs: "rounded-md",
  sm: "rounded-md",
  md: "rounded-lg",
  lg: "rounded-lg",
  xl: "rounded-xl",
} as const

export function OrganizationAvatar({
  name,
  slug,
  logo,
  size = "md",
  shape = "rounded",
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
        shape === "circle" ? "rounded-full" : roundedShapeClasses[size],
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
