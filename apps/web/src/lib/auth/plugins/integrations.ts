import type { BetterAuthPlugin } from "better-auth"

/**
 * Registry for Better-Auth ecosystem plugins and app action integrations.
 *
 * Use this module to define plugins that expose API actions or integrations
 * (e.g. third-party connectors, webhooks, multi-tenant app tools) beyond core auth.
 */

export interface AppIntegrationPluginConfig {
  id: string
  name: string
  plugin: BetterAuthPlugin
}

/**
 * Declared list of application integration plugins.
 * Add custom ecosystem plugins here to recompose them into Better-Auth.
 */
export const appIntegrationPlugins: readonly BetterAuthPlugin[] = []

export function getAppIntegrationPlugins(): readonly BetterAuthPlugin[] {
  return appIntegrationPlugins
}
