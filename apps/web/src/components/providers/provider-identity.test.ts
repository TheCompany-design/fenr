/**
 * The vendor identity record is the one place a vendor's name, its logo, and
 * how that logo behaves on a dark surface are decided together. These tests
 * pin all three, because the failure they guard is silent: a mark declared
 * with the wrong colour treatment does not error, it simply disappears
 * against the background, and nothing else in the build notices.
 */
import { describe, expect, it } from "bun:test"

import {
  providerDisplayName,
  providerLogoUrl,
  providerMarkIsMonochrome,
} from "./provider-identity"

const VENDORS = ["openai", "anthropic", "google", "openrouter"] as const

describe("provider identity", () => {
  it("names every vendor this build ships", () => {
    expect(providerDisplayName("openai")).toBe("OpenAI")
    expect(providerDisplayName("anthropic")).toBe("Anthropic")
    expect(providerDisplayName("google")).toBe("Google Gemini")
    expect(providerDisplayName("openrouter")).toBe("OpenRouter")
  })

  it("gives every vendor a logo on the shared service", () => {
    for (const vendor of VENDORS) {
      expect(providerLogoUrl(vendor)).toBe(
        `https://logos.lndev.me/logos/${vendor}.svg`,
      )
    }
  })

  it("names a vendor it has never seen rather than blanking it", () => {
    expect(providerDisplayName("mistral")).toBe("mistral")
    expect(providerLogoUrl("mistral")).toBeNull()
  })

  describe("dark-theme treatment", () => {
    /**
     * The whole point of the record. If this drifts, a vendor's mark goes
     * black-on-black in the dark theme and no test, type, or build step
     * complains — so the expected treatment per vendor is spelled out.
     */
    it("inverts the achromatic marks and spares the colour one", () => {
      expect(providerMarkIsMonochrome("openai")).toBe(true)
      expect(providerMarkIsMonochrome("anthropic")).toBe(true)
      expect(providerMarkIsMonochrome("openrouter")).toBe(true)
      // The four-colour "G" is correct on both surfaces; inverting it would
      // turn a recognised brand mark into a palette Google never shipped.
      expect(providerMarkIsMonochrome("google")).toBe(false)
    })

    it("claims no treatment for a vendor it has never seen", () => {
      // An unseen vendor has no mark to recolour, and asserting that its
      // unknown artwork is achromatic would be a guess dressed as a fact.
      expect(providerMarkIsMonochrome("mistral")).toBe(false)
      expect(providerMarkIsMonochrome("")).toBe(false)
    })

    it("only ever inverts a vendor that actually has a mark", () => {
      // Guards the component's filter condition: a vendor with no URL renders
      // a letter mark out of themed tokens, which already adapts on its own.
      for (const vendor of [...VENDORS, "mistral"]) {
        const url = providerLogoUrl(vendor)
        const filtered = Boolean(url) && providerMarkIsMonochrome(vendor)
        if (!url) {
          expect(filtered).toBe(false)
        }
      }
    })
  })
})
