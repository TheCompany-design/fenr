/**
 * OAuth App Integration contracts.
 *
 * Designed for third-party integrations that perform application-level operations
 * (e.g. GitHub repos, Google Calendar/Drive, Slack bots) beyond user identity verification.
 */

export interface OAuthIntegrationConfig {
  /** Unique integration identifier (e.g., 'google-drive', 'github-repo', 'slack-notify') */
  readonly id: string
  /** Human-readable integration display name */
  readonly name: string
  /** Scopes required for application functionality beyond basic profile/email */
  readonly scopes: readonly string[]
  /** Environment configuration flag checking if the integration credentials exist */
  readonly isConfigured: boolean
}

export interface OAuthIntegrationRegistry {
  getIntegration(id: string): OAuthIntegrationConfig | undefined
  getAllIntegrations(): readonly OAuthIntegrationConfig[]
}

/**
 * Registry of available OAuth app integrations for non-auth application features.
 * Expand this registry as integrations (e.g., Slack, GitHub repo management, Google Drive) are added.
 */
export const OAUTH_APP_INTEGRATIONS: readonly OAuthIntegrationConfig[] = []

export function getOAuthIntegration(
  id: string,
): OAuthIntegrationConfig | undefined {
  return OAUTH_APP_INTEGRATIONS.find((integration) => integration.id === id)
}

export function getAllOAuthIntegrations(): readonly OAuthIntegrationConfig[] {
  return OAUTH_APP_INTEGRATIONS
}
