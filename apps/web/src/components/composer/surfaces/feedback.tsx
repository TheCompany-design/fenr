import { Alert02Icon, InformationCircleIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@workspace/ui/components/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { cn } from "@workspace/ui/lib/utils"
import { AnimatePresence, motion } from "motion/react"
import { useEffect } from "react"
import type { ReasoningLevel } from "../catalog/capabilities"
import { levelAt } from "../catalog/effort"
import { TRANSITION_LAYOUT } from "../catalog/motion"
import type { Blocker, Notice } from "../catalog/reconcile"
import { usePromptEffort, usePromptStore } from "../state/prompt-store"

/**
 * Renders the two channels `reconcile` produces.
 *
 * They look similar but are not interchangeable, and the difference is the
 * reason they are separate surfaces:
 *
 *   Blocker — the user has a decision to make. Send is disabled and the
 *             message names the decision, with a button that resolves it.
 *   Notice  — something was adjusted on their behalf. Informational, auto-dismissed.
 *
 * Showing a blocker as a dismissible toast would be a lie: it is not
 * informational, and dismissing it would not make send possible.
 */
export function ComposerFeedback({ className }: { className?: string }) {
  const blockers = usePromptStore((s) => s.blockers)
  const notices = usePromptStore((s) => s.notices)
  const dismissNotice = usePromptStore((s) => s.dismissNotice)
  // Notices name levels, and a level's id is the provider's wire vocabulary
  // rather than something to show a person — `xhigh`, `medium_effort` and
  // `BALANCED` would all be read out verbatim. Resolved against the same scale
  // the notice was raised from.
  const effortLevels = usePromptEffort().levels

  // Notices are transient by definition — they report something already done.
  useEffect(() => {
    if (notices.length === 0) return
    const timer = setTimeout(dismissNotice, 6000)
    return () => clearTimeout(timer)
  }, [notices, dismissNotice])

  const actionable = blockers.filter((blocker) => blocker.kind !== "no-model")

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <AnimatePresence initial={false}>
        {actionable.map((blocker) => (
          <motion.div
            key={blockerKey(blocker)}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={TRANSITION_LAYOUT}
            className="overflow-hidden"
          >
            <BlockerRow blocker={blocker} />
          </motion.div>
        ))}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {notices.length > 0 ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={TRANSITION_LAYOUT}
            className="overflow-hidden"
          >
            <p className="text-muted-foreground flex items-center gap-1.5 px-3 py-1 text-xs">
              <HugeiconsIcon
                icon={InformationCircleIcon}
                className="size-3.5 shrink-0"
              />
              {describeNotices(notices, effortLevels)}
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

function blockerKey(blocker: Blocker): string {
  return blocker.kind === "vision"
    ? `vision:${blocker.attachments.map((a) => a.id).join(",")}`
    : blocker.kind
}

function BlockerRow({ blocker }: { blocker: Blocker }) {
  const removeAttachment = usePromptStore((s) => s.removeAttachment)

  switch (blocker.kind) {
    case "vision": {
      const names = blocker.attachments
        .map((a) => a.name)
        .slice(0, 2)
        .join(", ")
      const extra = blocker.count - Math.min(2, blocker.count)
      return (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs">
          <HugeiconsIcon
            icon={Alert02Icon}
            className="size-4 shrink-0 text-amber-500"
          />
          <span className="min-w-0 flex-1">
            <span className="font-medium">Images need a vision model.</span>{" "}
            <span className="text-muted-foreground">
              {names}
              {extra > 0 ? ` and ${extra} more` : ""} can't be sent to{" "}
              {usePromptStore.getState().caps.model?.name}.
            </span>
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 shrink-0 px-2 text-xs"
            onClick={() => {
              blocker.attachments.forEach((a) => {
                removeAttachment(a.id)
              })
            }}
          >
            Remove
          </Button>
        </div>
      )
    }

    case "context-overflow": {
      const { usage } = blocker
      return (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs">
          <HugeiconsIcon
            icon={Alert02Icon}
            className="size-4 shrink-0 text-amber-500"
          />
          <span className="min-w-0 flex-1">
            <span className="font-medium">Context window exceeded.</span>{" "}
            <span className="text-muted-foreground">
              {formatTokens(usage.used)} used of {formatTokens(blocker.window)},
              {` ${formatTokens(blocker.overflow)} over.`}
            </span>
          </span>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 shrink-0 px-2 text-xs"
                />
              }
            >
              Breakdown
            </TooltipTrigger>
            <TooltipContent side="top">
              <div className="flex flex-col gap-0.5 text-xs">
                {Object.entries(usage.breakdown).map(([key, value]) => (
                  <span key={key} className="flex justify-between gap-4">
                    <span className="capitalize opacity-70">{key}</span>
                    <span className="tabular-nums">{formatTokens(value)}</span>
                  </span>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        </div>
      )
    }

    case "files":
      return (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs">
          {blocker.rejected.map((entry) => entry.reason).join("; ")}
        </div>
      )

    case "provider-unready":
      return (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs">
          This provider needs a key before you can send.
        </div>
      )

    default:
      return null
  }
}

function describeNotices(
  notices: readonly Notice[],
  effortLevels: readonly ReasoningLevel[],
): string {
  return notices
    .map((notice) => {
      switch (notice.kind) {
        case "effort-clamped":
          return `Effort set to ${levelAt(effortLevels, notice.to)?.label ?? notice.to}.`
        case "effort-dropped":
          return "Effort isn't available on this model."
        case "tools-pruned":
          return `${notice.removed.length} tool${notice.removed.length === 1 ? "" : "s"} turned off for this model.`
        case "search-disabled":
          return "Web search isn't available on this model."
        default:
          return ""
      }
    })
    .join(" ")
}

export function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`
  if (tokens >= 1000) return `${Math.round(tokens / 1000)}k`
  return `${tokens}`
}
