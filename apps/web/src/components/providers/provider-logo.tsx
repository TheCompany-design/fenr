/**
 * A vendor's mark.
 *
 * The logo *is* the name: wherever a vendor's name used to be spelled out, the
 * mark stands in its place, and a delayed tooltip names it — the hover reads
 * the name for anyone who has not learned the marks yet, and the tooltip is
 * delayed so moving across a row of them does not strobe four popups open.
 *
 * The image carries the name as its `alt`: the accessible name is the
 * vendor's, and the tooltip repeats it for pointing devices on a delay.
 */
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { cn } from "@workspace/ui/lib/utils"

import { providerDisplayName, providerLogoUrl } from "./provider-identity"

export function ProviderLogo({
  provider,
  /** The name the tooltip shows, when it differs from the vendor's own. */
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
                // Deliberately eager: a lazy image mounted inside a
                // freshly-inserted subtree fires its load before layout and
                // Chromium fails it without a network error — the mark then
                // reads as permanently broken. These are 16px SVGs beside
                // interactive controls; lazy buys nothing. The onError retry
                // is the backstop for any other transient failure.
                onError={(event) => {
                  const img = event.currentTarget;
                  const original = img.src;
                  img.removeAttribute("src");
                  window.setTimeout(() => {
                    img.src = original;
                  }, 400);
                }}
                className={cn("shrink-0", className)}
              />
            ) : (
              // A vendor this build has never seen: a letter mark names it
              // honestly rather than a broken image pretending otherwise.
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
