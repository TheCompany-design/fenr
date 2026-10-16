/**
 * Everything the composer knows about reasoning effort, expressed against the
 * levels a model declares.
 *
 * This module exists because four questions — which level is lit, how far along
 * the bar the knob sits, what should happen when the model changes, and what a
 * level is worth in tokens — were each answered by ranking a level's *name*
 * against a hardcoded `none…max` table. There were five copies of that table in
 * this folder and they did not agree with each other, or with any provider:
 *
 *   - the control compared a *global* index with a *model-local* one, so a model
 *     whose levels begin at `low` showed `medium` as chosen while the store held
 *     `low`;
 *   - the clamp scored every name it did not recognise at -1, so switching to a
 *     model with different names left every level tied at the same distance and
 *     the winner was whichever happened to be declared first;
 *   - the budget ratio divided by the global list's length, so a four-level model
 *     spent three quarters of its budget range in three quarters of the bar.
 *
 * None of that is recoverable from the names. A provider's scale is whatever the
 * provider says it is, and the declaration order *is* the order. So the only
 * decision left is where this logic lives: here, once, over the model's own list.
 *
 * There is deliberately no function here that compares two level *names*. That is
 * the operation that cannot be done correctly, and pretending otherwise is what
 * produced every bug above.
 */

import type {
  EffortLevelId,
  ReasoningLevel,
  ReasoningScale,
} from "./capabilities"

/**
 * Where a level sits on the model's own scale.
 *
 * -1 when it is not on offer, which is a real answer: the control uses it to
 * decide it has nothing to light, and `settleLevel` uses it to decide whether the
 * stored level survived the change of model.
 */
export function levelIndex(
  levels: readonly ReasoningLevel[],
  id: EffortLevelId | null,
): number {
  if (id === null) return -1
  return levels.findIndex((level) => level.id === id)
}

/** The level as declared, for its label. Null when it is not on offer. */
export function levelAt(
  levels: readonly ReasoningLevel[],
  id: EffortLevelId | null,
): ReasoningLevel | null {
  const index = levelIndex(levels, id)
  return index < 0 ? null : levels[index]
}

/**
 * How far along the model's scale a level sits, as a fraction of the whole.
 *
 * Both the knob's position on the bar and the share of a token budget a level
 * buys are this question, which is why they share this function rather than
 * each rounding differently.
 *
 * Divided by the level *count*, not by `count - 1`: the first level is worth
 * something. A budget of zero is not "no reasoning", it is a request the provider
 * rejects, so the scale starts at `1/n` and ends at `1`. If the last level ever
 * needs to be worth more than the whole budget, that is a change to this
 * function and to the encoding that calls it — not something each call site
 * should be re-deciding.
 */
export function levelRatio(
  levels: readonly ReasoningLevel[],
  id: EffortLevelId | null,
): number {
  if (levels.length === 0) return 0
  const index = levelIndex(levels, id)
  if (index < 0) return 0
  return (index + 1) / levels.length
}

/**
 * Where a level's *mark* sits along a bar of levels, as a fraction.
 *
 * Deliberately not `levelRatio`. That is what a level is worth — the first level
 * is worth `1/n` of a token budget — and worth is not where a mark belongs: a
 * first level that is worth one n-th but whose mark sat at `1/n` would leave a
 * stretch of bar before it that no level can ever claim, so the knob could never
 * reach either end of the track.
 *
 * Marks therefore span the whole bar, ends included, which is also why a
 * one-level scale is centred rather than left at zero: with nothing to compare it
 * to, the middle is the honest place, and `0/0` is not.
 */
export function levelPosition(
  levels: readonly ReasoningLevel[],
  id: EffortLevelId | null,
): number {
  const index = levelIndex(levels, id)
  if (index < 0) return 0
  if (levels.length <= 1) return 0.5
  return index / (levels.length - 1)
}

/**
 * The level a narrowed scale should default to when the model's own declared
 * default was taken away by the key's entitlement.
 *
 * The *lowest* level the model offers, and the same answer `settleLevel` gives.
 * One policy in one module, because the two used to disagree: this path fell
 * back to the last level while `settleLevel` fell back to the first, so the same
 * key could be told its effort was raised to the maximum on one path and left
 * alone on the other. Falling back to the maximum spends the user's tokens
 * because their plan could not reach the setting they asked for — the one
 * adjustment that should never be made silently on their behalf.
 */
export function narrowedDefault(levels: readonly ReasoningLevel[]): string {
  return levels[0]?.id ?? ""
}

/**
 * The level to settle on when the stored one is not on offer.
 *
 * There is no "nearest" level without a shared vocabulary to measure against,
 * and that is exactly why this is not the arithmetic it used to be: `minimal`
 * means nothing to a model that offers `low`…`high`, and ranking two
 * vocabularies against each other would mean inventing an ordering the provider
 * never stated. So an unknown level falls to the model's own *declared default* —
 * the one level its provider says it should run at, which until now was computed
 * in the resolver and then read by nobody.
 *
 * Null only when the model offers no levels at all, which the caller treats as
 * "reasoning is off" rather than as a level.
 */
export function settleLevel(
  levels: readonly ReasoningLevel[],
  requested: EffortLevelId | null,
  preferred: EffortLevelId,
): EffortLevelId | null {
  if (levels.length === 0) return null
  if (levelIndex(levels, requested) >= 0) return requested
  return levelIndex(levels, preferred) >= 0 ? preferred : levels[0].id
}

/**
 * The declared scale, narrowed to what a key may use.
 *
 * The intersection keeps the model's order, because the model's order is the
 * scale — narrowing a scale must not renumber it. This is the one place
 * entitlement is allowed to touch the list, and it cannot reorder it.
 */
export function narrowScale(
  scale: ReasoningScale,
  permitted: readonly EffortLevelId[] | undefined,
): ReasoningScale {
  if (!permitted) return scale
  return {
    levels: scale.levels.filter((level) => permitted.includes(level.id)),
    default: scale.default,
  }
}
