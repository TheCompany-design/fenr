import { describe, expect, it } from "bun:test"

import { logoUrl } from "@/lib/brand/logos"

import {
  getSocialProvider,
  SOCIAL_PROVIDERS,
  type SocialProviderId,
} from "./social"

describe("Social Providers Registry", () => {
  it("defines standard social providers with secure logo CDN URLs", () => {
    expect(SOCIAL_PROVIDERS.length).toBe(3)

    // Spelled out without naming the service: a mark is an absolute https URL
    // ending in `.svg`. The address itself is the builder's business.
    for (const provider of SOCIAL_PROVIDERS) {
      const url = new URL(provider.logoUrl)
      expect(url.protocol).toBe("https:")
      expect(url.pathname).toMatch(/^\/logos\/[a-z0-9-]+\.svg$/)
    }
  })

  it("takes every mark from the shared logo service", () => {
    // The auth screens must not carry their own copy of the service address —
    // the sign-in button and a model vendor's mark are the same lookup, so
    // moving the service is one edit in `lib/brand/logos`.
    for (const provider of SOCIAL_PROVIDERS) {
      expect(provider.logoUrl).toBe(logoUrl(provider.id))
    }
  })

  it("enables Google provider and disables Apple/GitHub with friendly reasons", () => {
    const google = getSocialProvider("google")
    const apple = getSocialProvider("apple")
    const github = getSocialProvider("github")

    expect(google).toBeDefined()
    expect(google?.enabled).toBe(true)
    expect(google?.logoUrl).toBe(logoUrl("google"))
    expect(google?.invertInDarkMode).toBe(false)

    expect(apple).toBeDefined()
    expect(apple?.enabled).toBe(false)
    expect(apple?.disabledReason).toBe("Apple sign-in is coming soon")
    expect(apple?.logoUrl).toBe(logoUrl("apple"))
    expect(apple?.invertInDarkMode).toBe(true)

    expect(github).toBeDefined()
    expect(github?.enabled).toBe(false)
    expect(github?.disabledReason).toBe("GitHub sign-in is coming soon")
    expect(github?.logoUrl).toBe(logoUrl("github"))
    expect(github?.invertInDarkMode).toBe(true)
  })

  it("returns undefined for unrecognized provider ID", () => {
    const unknown = getSocialProvider("unknown" as unknown as SocialProviderId)
    expect(unknown).toBeUndefined()
  })
})
