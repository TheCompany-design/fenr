/**
 * How this app names and draws a model vendor.
 *
 * Pure data, no JSX: the composer's catalog module (which stays free of React)
 * and the logo component share one source of truth for the vendor's display
 * name, so a picker and a settings screen can never disagree about it.
 */

/**
 * Everything this build knows about one vendor's identity, declared together.
 *
 * `monochrome` sits beside `logoUrl` on purpose. The marks are external SVGs
 * served by a third party, so a dark theme cannot recolour them from the
 * outside — only a CSS filter can, and only for marks that carry no hue. The
 * two properties are coupled facts about one file: a mark fetched from the
 * service is either achromatic or it is not. Keeping them in one record means
 * adding a vendor is a single atomic edit, and there is no shape of that edit
 * that can ship a logo without saying how it behaves on a dark surface.
 */
interface VendorMark {
  /** The vendor's name as a person reads it. */
  readonly displayName: string
  /** The vendor's logo, from the shared SVG logo service. */
  readonly logoUrl: string
  /**
   * True when every pixel of the mark sits on the neutral axis (r === g ===
   * b), so inverting it in a dark theme only flips its lightness and never
   * shifts its hue. False for a full-colour brand mark, which is already
   * legible on light and dark surfaces and must be left exactly as served.
   */
  readonly monochrome: boolean
}

const VENDOR_MARKS: Readonly<Record<string, VendorMark>> = {
  openai: {
    displayName: "OpenAI",
    logoUrl: "https://logos.lndev.me/logos/openai.svg",
    monochrome: true,
  },
  anthropic: {
    displayName: "Anthropic",
    logoUrl: "https://logos.lndev.me/logos/anthropic.svg",
    monochrome: true,
  },
  google: {
    displayName: "Google Gemini",
    // The four-colour "G": brand colour is the mark, so it is correct on both
    // surfaces and inverting it would produce a palette Google never shipped.
    logoUrl: "https://logos.lndev.me/logos/google.svg",
    monochrome: false,
  },
  openrouter: {
    displayName: "OpenRouter",
    logoUrl: "https://logos.lndev.me/logos/openrouter.svg",
    monochrome: true,
  },
  antigravity: {
    displayName: "Google Antigravity",
    // Google's model mark in the chat's picker — the workspace asked for the
    // Antigravity pinwheel there instead of the corporate "G". Full colour
    // (one small black accent among eleven coloured paths), so like the "G"
    // it is correct as served on both surfaces.
    logoUrl: "https://logos.lndev.me/logos/google-antigravity.svg",
    monochrome: false,
  },
}

function markFor(provider: string): VendorMark | undefined {
  return VENDOR_MARKS[provider]
}

/**
 * The mark a *model* carries, which is not always its vendor's.
 *
 * Google's chat models are the Gemini family, and the picker draws them with
 * the Antigravity mark rather than the corporate "G" — the vendor's own
 * product mark for the models a conversation actually runs. Scoping it here
 * keeps the settings screen drawing the vendor's own "G" for the credential,
 * because there the row is about Google the vendor, not a model on it.
 *
 * `modelId` absent asks for the mark of a whole catalogue — the picker's
 * provider tab — which for Google is the Gemini family.
 */
export function modelMark(provider: string, modelId?: string): string {
  if (provider !== "google") return provider
  if (modelId === undefined) return "antigravity"
  return /gemini/i.test(modelId) ? "antigravity" : provider
}

/**
 * The vendor's name as a person reads it, for an entry without its own label.
 *
 * Tolerant on purpose: a runtime that learns a fifth vendor before this build
 * does still renders, naming the vendor it knows and this build does not.
 */
export function providerDisplayName(provider: string): string {
  return markFor(provider)?.displayName ?? provider
}

/**
 * The vendor's logo, from the shared SVG logo service.
 *
 * `null` for a vendor this build has never seen — the honest answer, which the
 * logo component renders as a letter mark rather than as a broken image.
 */
export function providerLogoUrl(provider: string): string | null {
  return markFor(provider)?.logoUrl ?? null
}

/**
 * Whether the vendor's mark is a monochrome mark that a dark theme must
 * invert to stay legible.
 *
 * Answering "false" for a vendor this build has never seen is deliberate: an
 * unseen vendor has no logo to invert (`providerLogoUrl` is `null` and the
 * letter mark renders instead), and claiming its unknown artwork is
 * achromatic would be a guess. The truthful answer is the safe one.
 */
export function providerMarkIsMonochrome(provider: string): boolean {
  return markFor(provider)?.monochrome ?? false
}
