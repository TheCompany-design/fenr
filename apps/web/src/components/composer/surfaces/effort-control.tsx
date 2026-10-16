import { ZapIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "@workspace/ui/lib/utils"
import {
  type EffortLevelId,
  isUsable,
  type ReasoningLevel,
} from "../catalog/capabilities"
import { levelIndex, levelRatio } from "../catalog/effort"
import { usePromptStore } from "../state/prompt-store"

/**
 * A segmented control rather than a dropdown, for two reasons that only become
 * obvious once it is wired up: the levels are a handful, and the choice is one
 * people make constantly during a session. A menu that opens on every change
 * costs a click and a dismissal each time.
 *
 * The segments are the *model's* levels intersected with the *key's*
 * entitlement, so a key that cannot reach `max` never shows a `max` segment to
 * be greyed out — it simply does not exist. Offering a disabled affordance for
 * something the account cannot buy is a dead end.
 *
 * Position comes from `levelIndex` over the model's own list. That is the whole
 * point: it used to index a fixed five-name table and compare the result with the
 * *model's* index, so any model whose levels did not begin at the bottom of that
 * table highlighted the wrong one — a model offering `low`…`max` with `low`
 * stored lit up `medium`.
 */
export function EffortControl({ className }: { className?: string }) {
  const caps = usePromptStore((s) => s.caps)
  const effort = usePromptStore((s) => s.effort)
  const setEffort = usePromptStore((s) => s.setEffort)

  if (!isUsable(caps.reasoning)) return null

  const levels = caps.reasoning.capability.levels
  if (levels.length === 0) return null

  const activeIndex = levelIndex(levels, effort)

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <HugeiconsIcon
        icon={ZapIcon}
        className="text-muted-foreground size-3.5 shrink-0"
      />
      <fieldset
        aria-label="Reasoning effort"
        className="bg-muted flex items-center gap-0.5 rounded-full p-0.5"
      >
        {levels.map((level, index) => {
          const active = index === activeIndex
          // Native inputs, visually hidden: arrow keys move between levels
          // without this component re-implementing roving focus.
          return (
            <label
              key={level.id}
              className={cn(
                "cursor-pointer rounded-full px-2 py-0.5 text-xs transition-colors",
                active
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <input
                type="radio"
                name="composer-effort"
                className="sr-only"
                checked={active}
                onChange={() => setEffort(level.id)}
              />
              {level.label}
            </label>
          )
        })}
      </fieldset>
    </div>
  )
}

/**
 * The provider-specific wire form, applied only at the submit boundary.
 *
 * Keeping this out of the store is the whole reason `EffortEncoding` exists:
 * the composer holds the level's *id* and each provider decides what that means.
 * An OpenAI key sends a string, an Anthropic key sends a token budget, and a
 * local model sends nothing at all.
 *
 * `levels` is required rather than optional because the budget form cannot be
 * computed without it. A token budget is a fraction of the provider's ceiling,
 * and the fraction is a position on *this model's* scale: dividing by a fixed
 * five made every model that did not offer five levels spend the wrong share of
 * its range, so `max` on a four-level model topped out at four fifths of the
 * ceiling it was entitled to.
 */
export function encodeEffort(
  effort: EffortLevelId | null,
  encoding: import("../catalog/capabilities").EffortEncoding,
  levels: readonly ReasoningLevel[],
): Record<string, unknown> {
  if (!effort || encoding.style === "none") return {}

  switch (encoding.style) {
    case "enum":
      return { [encoding.field]: effort }
    case "level":
      return { [encoding.field]: effort.toUpperCase() }
    case "budget": {
      // Proportional to this model's own scale rather than linear in the enum,
      // so `medium` sits in the middle of the budget instead of a third of the
      // way, and the top level is entitled to the whole ceiling.
      //
      // Not rounded to a multiple of anything. The old rounding to 1024 was for
      // tidier numbers, and it cost the top level the top: a ceiling of 32 000
      // is not a multiple of 1024, so the highest effort a user could ask for
      // was silently 31 744 tokens — the one level that is supposed to be the
      // whole range was the only one that could never be.
      return {
        [encoding.field]: Math.round(encoding.max * levelRatio(levels, effort)),
      }
    }
  }
}
