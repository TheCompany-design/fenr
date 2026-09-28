/**
 * Social authentication provider configurations and metadata.
 *
 * All company/brand logos are fetched directly from https://logos.lndev.me/
 * per Fenr architectural standards.
 */

export type SocialProviderId = "google" | "apple" | "github"

export interface SocialProviderConfig {
  readonly id: SocialProviderId
  readonly name: string
  readonly label: string
  readonly enabled: boolean
  readonly disabledReason?: string
  readonly logoUrl: string
  readonly invertInDarkMode?: boolean
}

export const SOCIAL_PROVIDERS: readonly SocialProviderConfig[] = [
  {
    id: "google",
    name: "Google",
    label: "Continue with Google",
    enabled: true,
    logoUrl: "https://logos.lndev.me/logos/google.svg",
    invertInDarkMode: false,
  },
  {
    id: "apple",
    name: "Apple",
    label: "Continue with Apple",
    enabled: false,
    disabledReason: "Apple sign-in is coming soon",
    logoUrl: "https://logos.lndev.me/logos/apple.svg",
    invertInDarkMode: true,
  },
  {
    id: "github",
    name: "GitHub",
    label: "Continue with GitHub",
    enabled: false,
    disabledReason: "GitHub sign-in is coming soon",
    logoUrl: "https://logos.lndev.me/logos/github.svg",
    invertInDarkMode: true,
  },
] as const

/**
 * Look up a social provider config by its provider identifier.
 */
export function getSocialProvider(
  id: SocialProviderId,
): SocialProviderConfig | undefined {
  return SOCIAL_PROVIDERS.find((provider) => provider.id === id)
}
