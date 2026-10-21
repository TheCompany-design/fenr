import { cn } from "@workspace/ui/lib/utils"
import type * as React from "react"
import { isUsable } from "../catalog/capabilities"
import { levelIndex, levelPosition, settleLevel } from "../catalog/effort"
import { usePromptStore } from "../state/prompt-store"

export function EffortControl({ className }: { className?: string }) {
  const caps = usePromptStore((s) => s.caps)
  const effort = usePromptStore((s) => s.effort)
  const setEffort = usePromptStore((s) => s.setEffort)

  if (!isUsable(caps.reasoning)) return null

  const levels = caps.reasoning.capability.levels
  if (levels.length === 0) return null

  const settled = settleLevel(levels, effort, caps.reasoning.capability.default)
  const index = Math.max(0, levelIndex(levels, settled))
  const active = levels[index]
  const at = levelPosition(levels, active.id)

  const solo = levels.length === 1

  return (
    <div
      className={cn("effort-bar-scope flex min-w-0 flex-col gap-2", className)}
    >
      {}
      <div
        data-effort-labels=""
        aria-hidden
        className="relative mx-[calc(var(--effort-thumb-w)/2)] h-4"
      >
        {levels.map((level, i) => (
          <span
            key={level.id}
            data-effort-label={level.id}
            data-active={level.id === active.id}
            className={cn(
              "absolute top-0 whitespace-nowrap text-xs transition-colors",
              labelAnchor(i, levels.length),
              level.id === active.id
                ? "text-foreground font-medium"
                : "text-muted-foreground",
            )}
            style={{ left: `${levelPosition(levels, level.id) * 100}%` }}
          >
            {level.label}
          </span>
        ))}
      </div>

      <div className="relative flex items-center">
        {/* The marks, behind the control and inert: they are a picture of the
            scale, and the input below is what changes it.

            Inset by half the knob's width, because that is the range the knob's
            centre can actually travel — a native range keeps its thumb wholly
            inside the track, so a mark at the track's very end would be a
            position no setting could ever occupy. Derived from the same
            variable the knob is sized from, so the two cannot drift apart. */}
        <div
          data-effort-marks=""
          className="pointer-events-none absolute inset-x-[calc(var(--effort-thumb-w)/2)] top-1/2 -translate-y-1/2"
        >
          {levels.map((level) => (
            <span
              key={level.id}
              data-level-mark={level.id}
              data-active={level.id === active.id}
              className={cn(
                "absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full",
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
 * How a label meets its stop.
 *
 * The first level's name hugs the left end and the last hugs the right, so a
 * two-level scale reads as plain endpoints and no text overhangs the bar;
 * every level in between is centred on its own mark. A one-level scale has
 * neither end — with nothing on either side, a name hung flush left would sit
 * beside nothing — so it is centred. Translates rather than offsets, because
 * the `left` value stays the level's own position on the scale for every
 * anchor.
 */
function labelAnchor(index: number, count: number): string {
  if (count === 1) return "-translate-x-1/2"
  if (index === 0) return ""
  if (index === count - 1) return "-translate-x-full"
  return "-translate-x-1/2"
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
