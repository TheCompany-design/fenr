import { serverEnv } from "@/lib/env"

export interface GoogleProviderConfig {
  clientId: string
  clientSecret: string
}

export function getGoogleSocialProvider(): GoogleProviderConfig | undefined {
  if (serverEnv.GOOGLE_CLIENT_ID && serverEnv.GOOGLE_CLIENT_SECRET) {
    return {
      clientId: serverEnv.GOOGLE_CLIENT_ID,
      clientSecret: serverEnv.GOOGLE_CLIENT_SECRET,
    }
  }
  return undefined
}
