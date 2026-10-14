/**
 * How this app names and draws a model vendor.
 *
 * Pure data, no JSX: the composer's catalog module (which stays free of React)
 * and the logo component share one source of truth for the vendor's display
 * name, so a picker and a settings screen can never disagree about it.
 *
 * This is also the *only* place a model vendor's mark is decided — which mark,
 * from where, and how it behaves on a dark surface. No consumer picks between
 * marks or builds logo URLs itself: the record below is the single decision,
 * and a structural test pins that the logo service's address is named nowhere
 * else in the source tree. The service itself lives in `lib/brand/logos`.
 */

import { logoUrl } from "@/lib/brand/logos"

/**
 * Everything this build knows about one vendor's identity, declared together.
 *
 * `monochrome` sits beside `logoUrl` on purpose. The marks are external SVGs
 * served by a third party, so a dark theme cannot recolour them from the
 * outside — only a CSS filter can, and only for marks that carry no hue. The
 * two properties are coupled facts about one file: a mark fetched from the
 * service is either achromatic or it is not. Keeping them in one record means
 * there is no shape of a new vendor that can ship a mark without also saying
 * how it behaves on a dark surface.
 *
 * The list carries the `id` inline rather than as a record key so that the
 * id, the name, and the mark are one declaration. Surfaces that need to
 * *offer* vendors derive that list from here (`VENDORS`), which is what stops
 * a vendor being drawn in one place and absent from the menu that adds it.
 */
interface VendorMark {
  /** The vendor's key: what the runtime calls it on the wire. */
  readonly id: string
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

/**
 * The vendors this build ships, in the order surfaces should offer them.
 *
 * OpenRouter sits second, ahead of the named vendors: it is the "bring any
 * vendor" route, so it reads as an alternative rather than a fourth brand.
 * That ordering is a product decision and the settings menu renders in it.
 *
 * `as const` keeps `id` a literal union rather than widening it to `string`,
 * which is what lets a surface declare something per-vendor (`Record<
 * VendorId, …>`) and get a compile error for a vendor it forgot.
 */
const VENDOR_MARKS = [
  {
    id: "openai",
    displayName: "OpenAI",
    logoUrl: logoUrl("openai"),
    monochrome: true,
  },
  {
    id: "openrouter",
    displayName: "OpenRouter",
    logoUrl: logoUrl("openrouter"),
    monochrome: true,
  },
  {
    id: "anthropic",
    displayName: "Anthropic",
    logoUrl: logoUrl("anthropic"),
    monochrome: true,
  },
  {
    id: "google",
    displayName: "Google Gemini",
    // The Antigravity pinwheel, everywhere this vendor's models are drawn —
    // picker tabs, the active model's chip, and the settings rows alike. One
    // record means one mark: there is no surface where Google's models render
    // with a different logo than they do here. Full colour — the artwork is
    // eleven coloured paths, and the one `fill="black"` in the file is the
    // alpha mask's own definition, which paints nothing — so like any colour
    // mark it renders as served on both surfaces, and inverting it would
    // produce a palette Google never shipped.
    logoUrl: logoUrl("google-antigravity"),
    monochrome: false,
  },
  {
    id: "nvidia",
    displayName: "NVIDIA NIM",
    // NVIDIA's own green eye-mark, everywhere this vendor's models are drawn.
    // Full colour, so like Google's mark it renders as served on both
    // surfaces rather than being inverted into a palette NVIDIA never shipped.
    logoUrl: logoUrl("nvidia"),
    monochrome: false,
  },
] as const satisfies readonly VendorMark[]

/** One of the vendor keys this build knows. */
export type VendorId = (typeof VENDOR_MARKS)[number]["id"]

function markFor(provider: string): VendorMark | undefined {
  // An array scan rather than a record lookup, so that a vendor name arriving
  // from the runtime can never resolve to an inherited key such as
  // `constructor`. Note that the `?? null` / `?? false` fallbacks below would
  // already absorb that case; the scan is belt-and-braces, not a fix for an
  // observed bug.
  return VENDOR_MARKS.find((mark) => mark.id === provider)
}

/**
 * The vendors this build ships, in the order a surface should offer them.
 *
 * Settings derives its "add a provider" menu from this, so the set of vendors
 * the app can draw and the set it lets a workspace add are the same
 * declaration — a mark cannot exist for a vendor the menu refuses to offer.
 */
export const VENDORS: readonly {
  readonly id: VendorId
  readonly displayName: string
}[] = VENDOR_MARKS.map(({ id, displayName }) => ({ id, displayName }))

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
