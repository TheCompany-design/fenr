import type { BetterAuthPlugin } from "better-auth"

export interface AppIntegrationPluginConfig {
  id: string
  name: string
  plugin: BetterAuthPlugin
}

export const appIntegrationPlugins: readonly BetterAuthPlugin[] = []

export function getAppIntegrationPlugins(): readonly BetterAuthPlugin[] {
  return appIntegrationPlugins
}
