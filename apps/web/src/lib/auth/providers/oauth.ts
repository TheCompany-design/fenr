export interface OAuthIntegrationConfig {
  readonly id: string

  readonly name: string

  readonly scopes: readonly string[]

  readonly isConfigured: boolean
}

export interface OAuthIntegrationRegistry {
  getIntegration(id: string): OAuthIntegrationConfig | undefined
  getAllIntegrations(): readonly OAuthIntegrationConfig[]
}

export const OAUTH_APP_INTEGRATIONS: readonly OAuthIntegrationConfig[] = []

export function getOAuthIntegration(
  id: string,
): OAuthIntegrationConfig | undefined {
  return OAUTH_APP_INTEGRATIONS.find((integration) => integration.id === id)
}

export function getAllOAuthIntegrations(): readonly OAuthIntegrationConfig[] {
  return OAUTH_APP_INTEGRATIONS
}
