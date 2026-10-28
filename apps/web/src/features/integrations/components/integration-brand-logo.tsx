import { cn } from "@workspace/ui/lib/utils"

const LOGO_BASE_URL = "https://logos.lndev.me/logos"

export interface IntegrationBrandLogoProps {
  slug: string
  monochrome?: boolean
  size?: number
  className?: string
}

/**
 * The one approved source for integration brand marks. Monochrome marks
 * invert in dark mode so they stay visible on the dark surface.
 */
export function IntegrationBrandLogo({
  slug,
  monochrome = false,
  size = 24,
  className,
}: IntegrationBrandLogoProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`${LOGO_BASE_URL}/${slug}.svg`}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      className={cn(monochrome && "dark:invert", className)}
    />
  )
}
