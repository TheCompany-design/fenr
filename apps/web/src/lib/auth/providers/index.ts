/**
 * Better-Auth provider composition for server configuration.
 *
 * SERVER-ONLY: Combines OAuth and social provider credentials from environment variables.
 * For client-safe provider metadata, import directly from `@/lib/auth/providers/social`.
 */

import { getGoogleSocialProvider } from "./google"

export * from "./google"
export * from "./oauth"
export * from "./social"

/**
 * Builds the `socialProviders` option passed to `betterAuth(...)`.
 */
export function getSocialProvidersOption() {
  const google = getGoogleSocialProvider()
  return {
    ...(google ? { google } : {}),
  }
}
