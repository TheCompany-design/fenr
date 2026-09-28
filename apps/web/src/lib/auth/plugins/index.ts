import type { BetterAuthPlugin } from "better-auth"
import { createCookiesPlugin } from "./cookies"
import { getAppIntegrationPlugins } from "./integrations"
import { createJwtPlugin } from "./jwt"
import { createMagicLinkPlugin } from "./magic-link"
import { createOrganizationPlugin } from "./organization"

export * from "./cookies"
export * from "./integrations"
export * from "./jwt"
export * from "./magic-link"
export * from "./organization"

/**
 * Creates and orders all Better-Auth plugins.
 *
 * Invariant: `createCookiesPlugin()` (tanstackStartCookies) MUST stay last in the
 * plugin array so it can attach Set-Cookie headers to TanStack Start responses
 * (review-framework invariant #7).
 */
export function createAuthPlugins(): BetterAuthPlugin[] {
  return [
    createMagicLinkPlugin(),
    createOrganizationPlugin(),
    createJwtPlugin(),
    ...getAppIntegrationPlugins(),
    createCookiesPlugin(),
  ]
}
