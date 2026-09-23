import { tanstackStartCookies } from "better-auth/tanstack-start"

/**
 * TanStack Start cookie plugin.
 *
 * MUST remain the very last plugin in the plugin array so it can properly
 * attach Set-Cookie headers to TanStack Start responses (review-framework invariant #7).
 */
export function createCookiesPlugin() {
  return tanstackStartCookies()
}
