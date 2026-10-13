/**
 * How a listed model reads in the picker.
 *
 * The runtime answers with what each vendor published and nothing more, so
 * every field past the id is optional. That makes these formatters the place
 * where "the vendor did not say" becomes something a person can act on: an
 * absent context window reads as unknown rather than as zero, and an absent
 * price is left off entirely rather than shown as free.
 *
 * Pure and separate from the form so the rules can be tested without a
 * renderer, and so the same row reads identically wherever a model is listed.
 */
import type { ListedModel } from "@/lib/schemas/nabu"

/**
 * The name to show for a model.
 *
 * The vendor's own name when it published one, and the id otherwise. The id is
 * what a request carries, so it is never hidden — a name without its id would
 * leave someone unable to tell `claude-opus-4-8` from a preview of it.
 */
export function modelName(model: ListedModel): string {
  const name = model.display_name?.trim()
  return name && name !== model.id ? name : model.id
}

/**
 * The id, shown beside the name only when the two differ.
 *
 * Returns an empty string when it would repeat the name, so a caller can render
 * it unconditionally rather than branching on the model's shape.
 */
export function modelIdSuffix(model: ListedModel): string {
  return modelName(model) === model.id ? "" : model.id
}

/**
 * A token count at the precision a person reads it at: `1M`, `128k`, `4k`.
 *
 * Rounds rather than refusing. A window of 1048576 is a limit, not a verdict on
 * a request, and `1048576` in a dropdown helps nobody.
 */
export function formatTokenCount(count: number): string {
  if (!Number.isFinite(count) || count <= 0) return ""
  if (count >= 1_000_000) {
    // Rounded to a tenth first, then the trailing `.0` dropped: Google's
    // 1,048,576-token window is the "1M" window, and printing `1.0M` for it
    // spends the reader's attention on a decimal nobody wants.
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
