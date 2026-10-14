/**
 * Social authentication provider configurations and metadata.
 *
 * Brand marks come from the shared logo service, through its one builder —
 * this module decides *which* sign-in providers exist and how their marks
 * behave on a dark surface, never where the service lives.
 */

import { logoUrl } from "@/lib/brand/logos"

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
    logoUrl: logoUrl("google"),
    invertInDarkMode: false,
  },
  {
    id: "apple",
    name: "Apple",
    label: "Continue with Apple",
    enabled: false,
    disabledReason: "Apple sign-in is coming soon",
    logoUrl: logoUrl("apple"),
    invertInDarkMode: true,
  },
  {
    id: "github",
    name: "GitHub",
    label: "Continue with GitHub",
    enabled: false,
    disabledReason: "GitHub sign-in is coming soon",
    logoUrl: logoUrl("github"),
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
