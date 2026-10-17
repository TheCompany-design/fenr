import { cn } from "@workspace/ui/lib/utils"
import type * as React from "react"
import { isUsable } from "../catalog/capabilities"
import { levelIndex, levelPosition, settleLevel } from "../catalog/effort"
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
  // through the same rule the runtime applies, so what the bar shows and what
  // the turn request sends cannot disagree — showing `levels[0]` while the
  // request carried the old id is the kind of divergence nobody notices until
  // the runtime settles a different level than the name on screen.
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
 * The level's wire form is the runtime's knowledge, not the composer's.
 *
 * The composer holds the level's *id* and sends it as it stands (`SendOptions`
 * in the chat host); the runtime decides what that id becomes on each vendor's
 * wire. There is no provider-specific encoding here to get out of date the day
 * a provider recalibrates its control — which is exactly what happened when
 * Anthropic's thinking budget became an effort level and Gemini's `MINIMAL`
 * appeared beside OpenAI's `none`.
 */
