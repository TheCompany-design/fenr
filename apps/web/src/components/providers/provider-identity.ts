/**
 * How this app names and draws a model vendor.
 *
 * Pure data, no JSX: the composer's catalog module (which stays free of React)
 * and the logo component share one source of truth for the vendor's display
 * name, so a picker and a settings screen can never disagree about it.
 */

/**
 * The vendor's name as a person reads it, for an entry without its own label.
 *
 * Tolerant on purpose: a runtime that learns a fifth vendor before this build
 * does still renders, naming the vendor it knows and this build does not.
 */
export function providerDisplayName(provider: string): string {
  switch (provider) {
    case "openai":
      return "OpenAI"
    case "openrouter":
      return "OpenRouter"
    case "anthropic":
      return "Anthropic"
    case "google":
      return "Google Gemini"
    default:
      return provider
  }
}

/**
 * The vendor's logo, from the shared SVG logo service.
 *
 * `null` for a vendor this build has never seen — the honest answer, which the
 * logo component renders as a letter mark rather than as a broken image.
 */
export function providerLogoUrl(provider: string): string | null {
  switch (provider) {
    case "openai":
      return "https://logos.lndev.me/logos/openai.svg"
    case "anthropic":
      return "https://logos.lndev.me/logos/anthropic.svg"
    case "google":
      return "https://logos.lndev.me/logos/google.svg"
    case "openrouter":
      return "https://logos.lndev.me/logos/openrouter.svg"
    default:
      return null
  }
}
