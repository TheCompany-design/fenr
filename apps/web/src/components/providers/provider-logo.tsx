import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { cn } from "@workspace/ui/lib/utils"

import {
  providerDisplayName,
  providerLogoUrl,
  providerMarkIsMonochrome,
} from "./provider-identity"

export function ProviderLogo({
  provider,

  label,
  size = 16,
  className,
}: {
  provider: string
  label?: string | null
  size?: number
  className?: string
}) {
  const name = label ?? providerDisplayName(provider)
  const url = providerLogoUrl(provider)

  const themeFilter =
    url && providerMarkIsMonochrome(provider) ? "dark:invert" : undefined

  return (
    <TooltipProvider delay={400}>
      <Tooltip>
        <TooltipTrigger
          render={
            url ? (
              <img
                src={url}
                alt={name}
                width={size}
                height={size}
                onError={(event) => {
                  const img = event.currentTarget
                  const original = img.src
                  img.removeAttribute("src")
                  window.setTimeout(() => {
                    img.src = original
                  }, 400)
                }}
                className={cn("shrink-0", themeFilter, className)}
              />
            ) : (
              <span
                role="img"
                aria-label={name}
                className={cn(
                  "bg-muted text-muted-foreground grid shrink-0 place-items-center rounded-full text-[10px] font-semibold",
                  className,
                )}
                style={{ width: size, height: size }}
              >
                {name.charAt(0).toUpperCase()}
              </span>
            )
          }
        />
        <TooltipContent side="top">{name}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
