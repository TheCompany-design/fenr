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

export function createAuthPlugins(): BetterAuthPlugin[] {
  return [
    createMagicLinkPlugin(),
    createOrganizationPlugin(),
    createJwtPlugin(),
    ...getAppIntegrationPlugins(),
    createCookiesPlugin(),
  ]
}
