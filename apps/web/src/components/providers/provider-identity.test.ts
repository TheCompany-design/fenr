/**
 * The vendor identity record is the one place a vendor's name, its logo, and
 * how that logo behaves on a dark surface are decided together. These tests
 * pin all three, because the failure they guard is silent: a mark declared
 * with the wrong colour treatment does not error, it simply disappears
 * against the background, and nothing else in the build notices.
 */
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
    // Three of the four marks are stored under the vendor's own key.
    for (const vendor of ["openai", "anthropic", "openrouter"] as const) {
      expect(providerLogoUrl(vendor)).toBe(logoUrl(vendor))
    }
  })

  it("names a vendor it has never seen rather than blanking it", () => {
    expect(providerDisplayName("mistral")).toBe("mistral")
    expect(providerLogoUrl("mistral")).toBeNull()
  })

  it("gives Google the Antigravity mark, and no other vendor any second mark", () => {
    // One record per vendor, so Google's models render with the Antigravity
    // pinwheel in the picker, on the active-model chip, and in the settings
    // rows alike — there is no surface left that can decide differently.
    expect(providerLogoUrl("google")).toBe(logoUrl("google-antigravity"))
    // The `antigravity` pseudo-vendor is gone with it. It existed only so a
    // second decision layer could point at the same file, which is exactly the
    // split this record was built to remove — and an id nothing routes to now.
    expect(providerLogoUrl("antigravity")).toBeNull()
    expect(providerDisplayName("antigravity")).toBe("antigravity")
  })

  it("offers exactly the vendors it can name and draw", () => {
    // Settings builds its "add a provider" menu from this list. If a vendor
    // were declared without being offered, or offered without a mark, a
    // workspace could reach a vendor the app cannot draw — the exact split
    // this record exists to prevent.
    //
    // The order is pinned because it is a product decision (OpenRouter second,
    // as the "bring any vendor" route) that the menu inherits. It is pinned
    // here rather than on the rendered menu because the form stays closed until
    // a click, which a static render never performs.
    expect(VENDORS).toEqual([
      { id: "openai", displayName: "OpenAI" },
      { id: "openrouter", displayName: "OpenRouter" },
      { id: "anthropic", displayName: "Anthropic" },
      { id: "google", displayName: "Google Gemini" },
      { id: "nvidia", displayName: "NVIDIA NIM" },
    ])
    for (const vendor of VENDORS) {
      expect(providerLogoUrl(vendor.id)).not.toBeNull()
      // The two facts a menu entry needs, and cannot invent for itself.
      expect(providerDisplayName(vendor.id)).toBe(vendor.displayName)
    }
  })

  it("resolves no vendor key by way of the object prototype", () => {
    // The vendor name arrives from the runtime, which this build does not
    // control. The `?? null` / `?? false` fallbacks would absorb an inherited
    // member either way, so this is defence in depth against a record-shaped
    // rewrite rather than a regression being pinned today.
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
    /**
     * The whole point of the record. If this drifts, a vendor's mark goes
     * black-on-black in the dark theme and no test, type, or build step
     * complains — so the expected treatment per vendor is spelled out.
     */
    it("inverts the achromatic marks and spares the colour one", () => {
      expect(providerMarkIsMonochrome("openai")).toBe(true)
      expect(providerMarkIsMonochrome("anthropic")).toBe(true)
      expect(providerMarkIsMonochrome("openrouter")).toBe(true)
      // Google's mark is the Antigravity pinwheel, which is colour — eleven
      // coloured paths, and the one `fill="black"` in the file is the alpha
      // mask's own definition, which paints nothing. Inverting the mark would
      // trade a brand palette for a wrong one to save nothing at all.
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
      // Stated for every vendor rather than only the un-named ones, so a
      // vendor that lost its mark cannot slip past an assertion-free branch.
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
