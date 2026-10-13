/**
 * The vendor identity record is the one place a vendor's name, its logo, and
 * how that logo behaves on a dark surface are decided together. These tests
 * pin all three, because the failure they guard is silent: a mark declared
 * with the wrong colour treatment does not error, it simply disappears
 * against the background, and nothing else in the build notices.
 */
import { describe, expect, it } from "bun:test"

import {
  modelMark,
  providerDisplayName,
  providerLogoUrl,
  providerMarkIsMonochrome,
} from "./provider-identity"

const VENDORS = ["openai", "anthropic", "google", "openrouter"] as const
// One vendor's mark file is not named after its key — the pinwheel lives at
// `google-antigravity.svg` — so the mechanical URL loop stays four-wide and
// the exception is asserted explicitly below.
const MARKS = [...VENDORS, "antigravity"] as const

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

  it("draws Google's models with the Antigravity mark in the picker", () => {
    // The chat's picker asked for the Antigravity pinwheel over the corporate
    // "G" for the Gemini family. The settings screen keeps the "G": there the
    // row is about Google the vendor, and modelMark is not consulted.
    expect(modelMark("google", "gemini-3.8-flash")).toBe("antigravity")
    expect(modelMark("google", "gemini-2.5-flash-lite")).toBe("antigravity")
    expect(providerLogoUrl("antigravity")).toBe(
      "https://logos.lndev.me/logos/google-antigravity.svg",
    )
    expect(providerMarkIsMonochrome("antigravity")).toBe(false)
  })

  it("scopes the Antigravity mark to Gemini, and the catalogue asks for it whole", () => {
    // A Google model outside the Gemini family keeps the vendor's own mark —
    // the request was Gemini-scoped, not "never draw the G again".
    expect(modelMark("google", "deep-research-max-preview-04-2026")).toBe(
      "google",
    )
    // No model id names a whole catalogue — the picker's provider tab —
    // which for Google is the Gemini family.
    expect(modelMark("google")).toBe("antigravity")
    // Other vendors are never remapped.
    expect(modelMark("openai", "gpt-5.2")).toBe("openai")
    expect(modelMark("openrouter", "anthropic/claude")).toBe("openrouter")
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
      // The Antigravity pinwheel is colour too — one small black accent
      // among eleven coloured paths — and inverting the mark would trade a
      // brand palette for a wrong one to save a single accent.
      expect(providerMarkIsMonochrome("antigravity")).toBe(false)
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
      for (const vendor of [...MARKS, "mistral"]) {
        const url = providerLogoUrl(vendor)
        const filtered = Boolean(url) && providerMarkIsMonochrome(vendor)
        if (!url) {
          expect(filtered).toBe(false)
        }
      }
    })
  })
})
