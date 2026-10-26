import type { ListedModel } from "@/lib/schemas/nabu"

export function modelName(model: ListedModel): string {
  const name = model.display_name?.trim()
  return name && name !== model.id ? name : model.id
}

export function modelIdSuffix(model: ListedModel): string {
  return modelName(model) === model.id ? "" : model.id
}

export function formatTokenCount(count: number): string {
  if (!Number.isFinite(count) || count <= 0) return ""
  if (count >= 1_000_000) {
    const millions = Math.round((count / 1_000_000) * 10) / 10
    return Number.isInteger(millions)
      ? `${millions}M`
      : `${millions.toFixed(1)}M`
  }
  if (count >= 1_000) return `${Math.round(count / 1_000)}k`
  return String(count)
}

/**
 * A per-million price, at a precision that does not round a cheap model to zero.
 *
 * Bounded above as well as below. The runtime accepts any finite price a vendor
 * publishes, and `toFixed` switches to exponential notation at `1e21` — so a
 * vendor answering `"prompt": "1e300"` would otherwise render `$1e+306`, which
 * reads like a number nobody meant to publish. Past a thousand dollars per
 * million tokens the figure is a placeholder either way; saying so is honest and
 * costs the reader nothing.
 */
export function formatPrice(usd: number): string {
  if (!Number.isFinite(usd) || usd < 0) return ""
  if (usd >= 1_000) return "$1000+"
  const digits = usd > 0 && usd < 0.01 ? 4 : 2
  return `$${usd.toFixed(digits)}`
}

/**
 * What a model row says about itself, as one muted line.
 *
 * Deliberately not every field the vendor published: `max_output_tokens` is
 * carried all the way here and left out of the row. Three numbers on one line
 * stop being readable, and an output ceiling is a detail someone looks up after
 * they have already picked, not a differentiator they choose between. It stays
 * on the type, so anything that does want it can have it.
 *
 * Only the facts the vendor stated appear. A vendor that publishes a name and
 * nothing else yields an empty string, and the picker shows the model with no
 * trailing detail rather than with a row of dashes standing in for absent facts.
 */
export function modelFacts(model: ListedModel): string {
  const parts: string[] = []

  if (model.context_window) {
    parts.push(`${formatTokenCount(model.context_window)} context`)
  }
  if (model.pricing) {
    parts.push(
      `${formatPrice(model.pricing.input_usd)} / ${formatPrice(model.pricing.output_usd)} per M tokens`,
    )
  }
  if (model.accepts_images) {
    parts.push("images")
  }

  return parts.join(" · ")
}

/**
 * What a row says about the model's life on the vendor's own storefront.
 *
 * `storefront` is the runtime's overlay of what the vendor's own published
 * surfaces carry — the storefront catalog for NVIDIA, the retirement dates
 * OpenRouter publishes beside its listing. Three independent facts, each
 * with its own sentence, because each changes a choice differently: a
 * delisted model is one the vendor stopped selling, an unserving one is
 * listed but currently answers nothing, and a dated one is going away on a
 * day a person can see coming. Published-and-quiet says nothing: presence
 * is the unremarkable truth, and an unread surface must not read as a
 * verdict.
 */
export function storefrontWarning(model: ListedModel): string {
  const storefront = model.storefront
  if (!storefront) return ""
  if (!storefront.published) {
    return "No longer on the vendor's storefront"
  }
  if (storefront.serving === false) {
    return "Listed by the vendor, but not currently serving"
  }
  if (storefront.ends_on) {
    const when = formatIsoDate(storefront.ends_on)
    return when
      ? `The vendor retires it on ${when}`
      : "The vendor has announced its retirement"
  }
  return ""
}

/**
 * An ISO date, said the way a person reads it. An unparseable date falls
 * back to nothing rather than to a wrong day — the caller has its own
 * sentence for that.
 */
function formatIsoDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })
}
