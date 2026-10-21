import { describe, expect, it } from "bun:test"

import { logoUrl } from "@/lib/brand/logos"

import {
  providerDisplayName,
  providerLogoUrl,
  providerMarkIsMonochrome,
  VENDORS,
} from "./provider-identity"

describe("provider identity", () => {
  it("names every vendor this build ships", () => {
    expect(providerDisplayName("openai")).toBe("OpenAI")
    expect(providerDisplayName("anthropic")).toBe("Anthropic")
    expect(providerDisplayName("google")).toBe("Google Gemini")
    expect(providerDisplayName("openrouter")).toBe("OpenRouter")
  })

  it("gives every vendor a logo on the shared service", () => {
    for (const vendor of ["openai", "anthropic", "openrouter"] as const) {
      expect(providerLogoUrl(vendor)).toBe(logoUrl(vendor))
    }
  })

  it("names a vendor it has never seen rather than blanking it", () => {
    expect(providerDisplayName("mistral")).toBe("mistral")
    expect(providerLogoUrl("mistral")).toBeNull()
  })

  it("gives Google the Antigravity mark, and no other vendor any second mark", () => {
    expect(providerLogoUrl("google")).toBe(logoUrl("google-antigravity"))

    expect(providerLogoUrl("antigravity")).toBeNull()
    expect(providerDisplayName("antigravity")).toBe("antigravity")
  })

  it("offers exactly the vendors it can name and draw", () => {
    expect(VENDORS).toEqual([
      { id: "openai", displayName: "OpenAI" },
      { id: "openrouter", displayName: "OpenRouter" },
      { id: "anthropic", displayName: "Anthropic" },
      { id: "google", displayName: "Google Gemini" },
      { id: "nvidia", displayName: "NVIDIA NIM" },
    ])
    for (const vendor of VENDORS) {
      expect(providerLogoUrl(vendor.id)).not.toBeNull()

      expect(providerDisplayName(vendor.id)).toBe(vendor.displayName)
    }
  })

  it("resolves no vendor key by way of the object prototype", () => {
    for (const key of [
      "constructor",
      "__proto__",
      "toString",
      "hasOwnProperty",
    ]) {
      expect(providerLogoUrl(key)).toBeNull()
      expect(providerMarkIsMonochrome(key)).toBe(false)
    }
  })

  describe("dark-theme treatment", () => {
    it("inverts the achromatic marks and spares the colour one", () => {
      expect(providerMarkIsMonochrome("openai")).toBe(true)
      expect(providerMarkIsMonochrome("anthropic")).toBe(true)
      expect(providerMarkIsMonochrome("openrouter")).toBe(true)

      expect(providerMarkIsMonochrome("google")).toBe(false)
    })

    it("claims no treatment for a vendor it has never seen", () => {
      expect(providerMarkIsMonochrome("mistral")).toBe(false)
      expect(providerMarkIsMonochrome("")).toBe(false)
    })

    it("only ever inverts a vendor that actually has a mark", () => {
      const expected = {
        openai: true,
        anthropic: true,
        google: false,
        openrouter: true,
        mistral: false,
      }
      for (const [vendor, monochrome] of Object.entries(expected)) {
        const hasMark = providerLogoUrl(vendor) !== null
        expect(hasMark && providerMarkIsMonochrome(vendor)).toBe(
          hasMark && monochrome,
        )
      }
    })
  })
})
