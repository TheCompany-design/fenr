import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { cn } from "@workspace/ui/lib/utils"
import type { ContextUsage } from "../catalog/usage"
import { usePromptStore } from "../state/prompt-store"
import { formatTokens } from "./feedback"

/**
 * The context meter.
 *
 * A ring rather than a bar because the quantity is a proportion of a whole,
 * and a ring already encodes that. A bar needs a track behind it to read as a
 * proportion; a circle *is* the proportion. It also survives being tiny — a
 * 20px ring sits in the rail next to the model picker without crowding it,
 * which a bar with a numeric label could not.
 *
 * The fill is the arc length, not the colour, so the gauge is readable without
 * relying on red/amber/green; hue is a second signal rather than the first.
 *
 * Always rendered once there is a measurement. An earlier version hid it below
 * half full, which was calibrated for a wide bar carrying a "48%" label and
 * was pure noise for a 20px ring — and it made the control impossible to find
 * in exactly the empty-conversation case where a new user looks for it. A
 * quiet ring costs nothing; a control that is not there cannot be learned.
 */
const SIZE = 20
const STROKE = 2
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function ContextMeter({ className }: { className?: string }) {
  const usage = usePromptStore((s) => s.usage)

  if (!usage || usage.window === 0) return null

  const over = usage.overflow > 0
  // Thresholds mirror how the underlying APIs behave: most begin trimming or
  // rejecting well before the hard limit, so a late warning arrives too late
  // to act on.
  const warn = usage.ratio >= 0.8

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            // The tooltip is a visual affordance and cannot be relied on by a
            // screen reader, so the state is spelled out in the name.
            aria-label={`Context ${Math.round(usage.ratio * 100)} percent full, ${formatTokens(usage.used)} of ${formatTokens(usage.window)} tokens used`}
            className={cn(
              // `h-8` to match every other control in the rail. The meter grew
              // to whatever its content needed, which made the toolbar a few
              // pixels taller the moment a gauge appeared in it.
              "text-muted-foreground hover:text-foreground flex size-8 shrink-0 items-center justify-center rounded-full transition-colors",
              warn && !over && "text-amber-600",
              over && "text-destructive",
              className,
            )}
          />
        }
      >
        <Ring usage={usage} />
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-56">
        <ContextDetails usage={usage} />
      </TooltipContent>
    </Tooltip>
  )
}

function Ring({ usage }: { usage: ContextUsage }) {
  const over = usage.overflow > 0
  const filled = Math.min(1, Math.max(0, usage.ratio))

  return (
    <svg
      width={SIZE}
      height={SIZE}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      fill="none"
      aria-hidden
      className="-rotate-90"
    >
      <circle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={RADIUS}
        stroke="currentColor"
        strokeWidth={STROKE}
        className="opacity-20"
      />
      <circle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={RADIUS}
        stroke="currentColor"
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeDasharray={CIRCUMFERENCE}
        // A ratio of 1.5 cannot be drawn — the circle closes at 1 — so past
        // the limit the ring is simply full and the colour carries the
        // overflow. The exact figure lives in the tooltip.
        strokeDashoffset={CIRCUMFERENCE * (1 - filled)}
        className={cn(
          "transition-[stroke-dashoffset] duration-300",
          over && "text-destructive",
        )}
      />
    </svg>
  )
}

function ContextDetails({ usage }: { usage: ContextUsage }) {
  const over = usage.overflow > 0

  // Largest first: the question a breakdown is asked is "what is eating my
  // context", and alphabetical order makes the user hunt for the answer.
  const rows = Object.entries(usage.breakdown)
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1])

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-col">
        <span className="font-medium">
          {formatTokens(usage.used)} of {formatTokens(usage.window)} tokens
        </span>
        <span className="opacity-70">
          {over
            ? `${formatTokens(usage.overflow)} over the limit`
            : `${Math.round(usage.ratio * 100)}% of this model's context window`}
        </span>
      </div>

      {rows.length > 0 ? (
        <div className="flex flex-col gap-0.5 border-t border-current/15 pt-1.5">
          {rows.map(([key, value]) => (
            <span key={key} className="flex items-center justify-between gap-6">
              <span className="capitalize opacity-70">{key}</span>
              <span className="tabular-nums">{formatTokens(value)}</span>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}
