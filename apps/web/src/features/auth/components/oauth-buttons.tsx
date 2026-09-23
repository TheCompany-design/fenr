/**
 * Social OAuth provider buttons.
 *
 * Provides a shared, type-safe horizontal composition for Google, Apple, and GitHub.
 * Enabled providers initiate Better Auth social sign-in via TanStack Query mutation.
 * Inactive providers remain visibly disabled with descriptive tooltips.
 */
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import {
  SOCIAL_PROVIDERS,
  type SocialProviderConfig,
  type SocialProviderId,
} from "@/lib/auth/providers/social"
import { useSocialSignIn } from "../hooks/use-social-sign-in"

export { SOCIAL_PROVIDERS, type SocialProviderConfig, type SocialProviderId }

export interface OAuthButtonsProps {
  redirectTo?: string
  className?: string
  providers?: readonly SocialProviderConfig[]
}

export function OAuthButtons({
  redirectTo = "/",
  className,
  providers = SOCIAL_PROVIDERS,
}: OAuthButtonsProps) {
  const { mutate: signIn, isPending, variables } = useSocialSignIn()

  const isConnecting = isPending

  const handleSocialSignIn = (provider: SocialProviderConfig) => {
    if (!provider.enabled || isConnecting) {
      return
    }

    signIn({
      provider: provider.id,
      redirectTo,
    })
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      {providers.map((provider) => {
        const isLoading = isConnecting && variables?.provider === provider.id
        const isDisabled = !provider.enabled || isConnecting
        const tooltipTitle = provider.enabled
          ? provider.label
          : (provider.disabledReason ??
            `${provider.name} sign-in is coming soon`)

        return (
          <Button
            key={provider.id}
            variant="outline"
            size="lg"
            type="button"
            disabled={isDisabled}
            title={tooltipTitle}
            aria-label={provider.label}
            aria-disabled={isDisabled}
            onClick={() => handleSocialSignIn(provider)}
            className="flex-1 min-w-[100px] gap-2 font-medium"
          >
            <img
              src={provider.logoUrl}
              alt=""
              aria-hidden="true"
              loading="lazy"
              width={16}
              height={16}
              className={cn(
                "size-4 shrink-0",
                provider.invertInDarkMode && "dark:invert",
              )}
            />
            <span>{isLoading ? "Connecting…" : provider.name}</span>
          </Button>
        )
      })}
    </div>
  )
}
