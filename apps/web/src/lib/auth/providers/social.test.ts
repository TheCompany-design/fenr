import { describe, expect, it } from "bun:test"
import {
  getSocialProvider,
  SOCIAL_PROVIDERS,
  type SocialProviderId,
} from "./social"

describe("Social Providers Registry", () => {
  it("defines standard social providers with secure logo CDN URLs", () => {
    expect(SOCIAL_PROVIDERS.length).toBe(3)

    for (const provider of SOCIAL_PROVIDERS) {
      expect(provider.logoUrl).toMatch(
        /^https:\/\/logos\.lndev\.me\/logos\/[a-z0-9-]+\.svg$/,
      )
    }
  })

  it("enables Google provider and disables Apple/GitHub with friendly reasons", () => {
    const google = getSocialProvider("google")
    const apple = getSocialProvider("apple")
    const github = getSocialProvider("github")

    expect(google).toBeDefined()
    expect(google?.enabled).toBe(true)
    expect(google?.logoUrl).toBe("https://logos.lndev.me/logos/google.svg")
    expect(google?.invertInDarkMode).toBe(false)

    expect(apple).toBeDefined()
    expect(apple?.enabled).toBe(false)
    expect(apple?.disabledReason).toBe("Apple sign-in is coming soon")
    expect(apple?.logoUrl).toBe("https://logos.lndev.me/logos/apple.svg")
    expect(apple?.invertInDarkMode).toBe(true)

    expect(github).toBeDefined()
    expect(github?.enabled).toBe(false)
    expect(github?.disabledReason).toBe("GitHub sign-in is coming soon")
    expect(github?.logoUrl).toBe("https://logos.lndev.me/logos/github.svg")
    expect(github?.invertInDarkMode).toBe(true)
  })

  it("returns undefined for unrecognized provider ID", () => {
    const unknown = getSocialProvider("unknown" as unknown as SocialProviderId)
    expect(unknown).toBeUndefined()
  })
})
