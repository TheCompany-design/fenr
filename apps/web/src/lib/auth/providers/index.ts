import { getGoogleSocialProvider } from "./google"

export * from "./google"
export * from "./oauth"
export * from "./social"

export function getSocialProvidersOption() {
  const google = getGoogleSocialProvider()
  return {
    ...(google ? { google } : {}),
  }
}
