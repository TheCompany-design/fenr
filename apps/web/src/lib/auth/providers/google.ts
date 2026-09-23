import { serverEnv } from "@/lib/env"

export interface GoogleProviderConfig {
  clientId: string
  clientSecret: string
}

/**
 * Returns Google OAuth provider configuration for Better-Auth if credentials
 * are present in server environment variables.
 */
export function getGoogleSocialProvider(): GoogleProviderConfig | undefined {
  if (serverEnv.GOOGLE_CLIENT_ID && serverEnv.GOOGLE_CLIENT_SECRET) {
    return {
      clientId: serverEnv.GOOGLE_CLIENT_ID,
      clientSecret: serverEnv.GOOGLE_CLIENT_SECRET,
    }
  }
  return undefined
}
