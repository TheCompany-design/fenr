import { ZapIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "@workspace/ui/lib/utils"
import { type EffortLevel, isUsable } from "../catalog/capabilities"
import { effortLabel } from "../data/model-views"
import { usePromptStore } from "../state/prompt-store"

const ORDER: readonly EffortLevel[] = ["none", "low", "medium", "high", "max"]

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
 */
export function EffortControl({ className }: { className?: string }) {
  const caps = usePromptStore((s) => s.caps)
  const effort = usePromptStore((s) => s.effort)
  const setEffort = usePromptStore((s) => s.setEffort)

  if (!isUsable(caps.reasoning)) return null

  const levels = caps.reasoning.capability.levels
  if (levels.length === 0) return null

  const activeIndex = effort ? ORDER.indexOf(effort) : -1

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
              key={level}
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
                onChange={() => setEffort(level)}
              />
              {effortLabel(level)}
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
 * the composer holds `"high"` and each provider decides what that means. An
 * OpenAI key sends a string, an Anthropic key sends a token budget, and a
 * local model sends nothing at all.
 */
export function encodeEffort(
  effort: EffortLevel | null,
  encoding: import("../catalog/capabilities").EffortEncoding,
): Record<string, unknown> {
  if (!effort || encoding.style === "none") return {}

  switch (encoding.style) {
    case "enum":
      return { [encoding.field]: effort }
    case "level":
      return { [encoding.field]: effort.toUpperCase() }
    case "budget": {
      // A continuous budget expressed as discrete segments. The mapping is
      // proportional to the range rather than linear in the enum, so `medium`
      // sits at the middle of the budget instead of a third of the way.
      const ratio = (ORDER.indexOf(effort) + 1) / ORDER.length
      const budget = Math.round((encoding.max * ratio) / 1024) * 1024
      return { [encoding.field]: budget }
    }
  }
}
