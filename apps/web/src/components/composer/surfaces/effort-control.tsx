import { cn } from "@workspace/ui/lib/utils"
import type * as React from "react"
import {
  type EffortLevelId,
  isUsable,
  type ReasoningLevel,
} from "../catalog/capabilities"
import {
  levelIndex,
  levelPosition,
  levelRatio,
  settleLevel,
} from "../catalog/effort"
import { usePromptStore } from "../state/prompt-store"

/**
 * Effort as a bar with a mark per level.
 *
 * A bar rather than a row of buttons for one reason: the number of segments is
 * not ours to choose. Models here offer four levels and five, others offer two,
 * and a segmented control has to be given a width per segment whether the model
 * has two or six — so the segments get narrower as providers add levels, and the
 * one that is chosen gets harder to read. A bar's marks are placed at the
 * levels' own positions instead, so the control is the same shape whatever the
 * model offers and only the marks move.
 *
 * The chosen level's *name* is stated above the bar rather than left to the
 * reader to work out from the knob's position. The name is the provider's, not
 * the composer's: `level.label` is declared per model precisely so this text does
 * not have to be prettified from the id.
 *
 * The input is a real `<input type="range">`. Arrow keys, Home and End, and the
 * browser's own focus handling come with it, and `aria-valuetext` lets a screen
 * reader announce the level's name rather than its index — which is the whole
 * point of declaring labels.
 */
export function EffortControl({ className }: { className?: string }) {
  const caps = usePromptStore((s) => s.caps)
  const effort = usePromptStore((s) => s.effort)
  const setEffort = usePromptStore((s) => s.setEffort)

  if (!isUsable(caps.reasoning)) return null

  const levels = caps.reasoning.capability.levels
  if (levels.length === 0) return null

  // The reconciler settles the stored level onto this list on every mutation, so
  // a level that is not on offer means the list changed under us. Resolved
  // through the same rule the wire uses, so what the bar shows and what gets
  // encoded cannot disagree — showing `levels[0]` while `encodeEffort` sent
  // nothing, or sent the old id, is the kind of divergence nobody notices until
  // a provider rejects the request.
  const settled = settleLevel(levels, effort, caps.reasoning.capability.default)
  const index = Math.max(0, levelIndex(levels, settled))
  const active = levels[index]
  const at = levelPosition(levels, active.id)
  // A one-level scale has no range to travel. `max` must exceed `min` for the
  // control to be valid at all, which would otherwise leave a range input that
  // looks movable, announces "maximum 1", and does nothing when moved.
  const solo = levels.length === 1

  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)}>
      <span
        className="text-foreground text-center text-xs font-medium tabular-nums"
        aria-hidden
      >
        {active.label}
      </span>

      <div className="effort-bar-scope relative flex items-center">
        {/* The marks, behind the control and inert: they are a picture of the
            scale, and the input below is what changes it.

            Inset by half the knob, because that is the range the knob can
            actually travel — a native range keeps its thumb wholly inside the
            track, so a mark at the track's very end would be a position no
            setting could ever occupy. Derived from the same variable the knob is
            sized from, so the two cannot drift apart. */}
        <div
          data-effort-marks=""
          className="pointer-events-none absolute inset-x-[calc(var(--effort-thumb)/2)] top-1/2 -translate-y-1/2"
        >
          {levels.map((level) => (
            <span
              key={level.id}
              data-level-mark={level.id}
              data-active={level.id === active.id}
              className={cn(
                "absolute size-1 -translate-x-1/2 -translate-y-1/2 rounded-full",
                // The chosen level's own mark is hidden rather than drawn: the
                // knob is sitting on it, and two overlapping dots read as a
                // rendering fault rather than as emphasis.
                level.id === active.id
                  ? "bg-transparent"
                  : "bg-muted-foreground/40",
              )}
              style={{ left: `${levelPosition(levels, level.id) * 100}%` }}
            />
          ))}
        </div>

        <input
          type="range"
          min={0}
          max={Math.max(1, levels.length - 1)}
          // `disabled` rather than a degenerate range: a range input that cannot
          // move is a control that lies about being a control.
          disabled={solo}
          step={1}
          value={index}
          onChange={(event) => {
            const next = levels[Number(event.target.value)]
            if (next) setEffort(next.id)
          }}
          aria-label="Reasoning effort"
          // The value announced is the level's name, not its position: "medium"
          // rather than "2 of 4".
          aria-valuetext={active.label}
          // The fill, the knob and both engines' pseudo-elements live in the
          // stylesheet — see the `effort-bar` utility. Only `--effort-at`, the
          // chosen level's own position, is set here.
          className="effort-bar"
          style={{ "--effort-at": `${at * 100}%` } as React.CSSProperties}
        />
      </div>
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
  // A level this model does not offer is not this model's vocabulary, so it is
  // not this model's wire form either — and the failure modes differ by style.
  // A budget would be `0`, which is the one value a provider rejects outright;
  // an enum or level would forward a name the provider has never heard of. The
  // store's reconciler keeps the stored level on offer, so this is the boundary
  // holding for a caller that captured its payload across a change of model.
  if (levelIndex(levels, effort) < 0) return {}

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
