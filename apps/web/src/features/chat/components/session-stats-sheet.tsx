import {
  Alert02Icon,
  ArrowDown01Icon,
  ArrowRight01Icon,
  ChartHistogramIcon,
  Clock01Icon,
  Coins01Icon,
  CpuIcon,
  DatabaseIcon,
  FlashIcon,
  Layers01Icon,
  SparklesIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { cn } from "@workspace/ui/lib/utils"
import { useEffect, useState } from "react"
import { ProviderLogo } from "@/components/providers/provider-logo"
import { useSessionUsageTelemetry } from "../hooks/use-session-usage-telemetry"
import type { ActiveTurnProjection } from "../state/stream-reducer"
import type { ChatMessage } from "../types"

function formatUsd(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "—"
  if (amount === 0) return "$0.00"
  if (amount < 0.001) return `$${amount.toFixed(4)}`
  if (amount < 1) return `$${amount.toFixed(3)}`
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

function formatTokens(tokens: number): string {
  return new Intl.NumberFormat(undefined).format(tokens)
}

function compactTokens(tokens: number): string {
  return new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(tokens)
}

function formatPercent(rate: number | null | undefined): string {
  if (rate === null || rate === undefined) return "0%"
  return `${Math.round(rate * 100)}%`
}

function formatMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "—"
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

export interface SessionStatsSheetTriggerProps {
  readonly threadId?: string | null
  readonly messages?: readonly ChatMessage[]
  readonly activeTurn?: ActiveTurnProjection | null
  readonly isStreaming?: boolean
  readonly onOpen: () => void
  readonly className?: string
}

export function SessionStatsSheetTrigger({
  threadId,
  messages = [],
  activeTurn,
  isStreaming = false,
  onOpen,
  className,
}: SessionStatsSheetTriggerProps) {
  const telemetry = useSessionUsageTelemetry({
    threadId,
    messages,
    activeTurn,
    isStreaming,
  })

  const hasData = telemetry.totalTokens > 0 || telemetry.totalCostUsd > 0

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onOpen}
      aria-label="Open session usage statistics"
      className={cn(
        "group relative flex h-7 items-center gap-1.5 rounded-full border border-border/60 bg-muted/30 px-2.5 py-0 text-xs font-normal text-muted-foreground transition-all hover:border-border hover:bg-muted/70 hover:text-foreground",
        hasData && "font-mono tabular-nums text-[11px]",
        className,
      )}
    >
      {isStreaming && (
        <span className="relative flex size-2 items-center justify-center">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
        </span>
      )}

      {!hasData ? (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <HugeiconsIcon icon={ChartHistogramIcon} size={13} />
          <span>0 tok · $0.00</span>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          {telemetry.modelsUsed.length > 0 && (
            <div className="flex -space-x-1 items-center">
              {telemetry.modelsUsed.slice(0, 2).map((m) => (
                <div
                  key={`${m.provider}-${m.model}`}
                  className="rounded-full bg-background p-0.5 border border-border/40 shadow-xs"
                >
                  <ProviderLogo provider={m.provider} size={12} />
                </div>
              ))}
            </div>
          )}

          <span>{compactTokens(telemetry.totalTokens)} tok</span>

          {telemetry.cacheHitRate !== null && telemetry.cacheHitRate > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-0 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
              <span className="size-1 rounded-full bg-emerald-500" />
              {formatPercent(telemetry.cacheHitRate)} cache
            </span>
          )}

          <span className="font-semibold text-foreground">
            {formatUsd(telemetry.totalCostUsd)}
          </span>
        </div>
      )}
    </Button>
  )
}

export interface SessionStatsSheetProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly threadId?: string | null
  readonly messages?: readonly ChatMessage[]
  readonly activeTurn?: ActiveTurnProjection | null
  readonly isStreaming?: boolean
  readonly selectedTurnId?: string | null
}

export function SessionStatsSheet({
  open,
  onOpenChange,
  threadId,
  messages = [],
  activeTurn,
  isStreaming = false,
  selectedTurnId,
}: SessionStatsSheetProps) {
  const telemetry = useSessionUsageTelemetry({
    threadId,
    messages,
    activeTurn,
    isStreaming,
  })

  const [expandedTurns, setExpandedTurns] = useState<Record<string, boolean>>(
    {},
  )

  // Automatically expand selectedTurnId when requested
  useEffect(() => {
    if (selectedTurnId) {
      setExpandedTurns((prev) => ({ ...prev, [selectedTurnId]: true }))
    }
  }, [selectedTurnId])

  const toggleTurn = (turnId: string) => {
    setExpandedTurns((prev) => ({
      ...prev,
      [turnId]: !prev[turnId],
    }))
  }

  // Token composition percentages for the stacked horizontal bar
  const totalTokens = telemetry.totalTokens || 1
  const cachedPct = (telemetry.cachedInputTokens / totalTokens) * 100
  const uncachedPct = (telemetry.uncachedInputTokens / totalTokens) * 100
  const cacheWritePct = (telemetry.cacheCreationInputTokens / totalTokens) * 100
  const outputPct =
    (Math.max(0, telemetry.outputTokens - telemetry.reasoningTokens) /
      totalTokens) *
    100
  const reasoningPct = (telemetry.reasoningTokens / totalTokens) * 100

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl flex flex-col gap-0 p-0 overflow-hidden"
      >
        <SheetHeader className="p-6 border-b border-border/60 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-lg border border-border/60 bg-muted/40">
                <HugeiconsIcon
                  icon={ChartHistogramIcon}
                  size={16}
                  className="text-foreground"
                />
              </div>
              <div>
                <SheetTitle className="text-base font-semibold tracking-tight">
                  Session Telemetry
                </SheetTitle>
              </div>
            </div>
            {isStreaming && (
              <Badge
                variant="secondary"
                className="gap-1.5 border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono text-[11px]"
              >
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live streaming
              </Badge>
            )}
          </div>
          <SheetDescription className="text-xs text-muted-foreground mt-1">
            Real-time token accounting, prompt cache economics, and step-by-step
            model invocation ledger.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 min-h-0 w-full">
          <div className="px-6 py-5 space-y-6 text-sm">
            {/* SECTION A: Session Economics & Cost Breakdown */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <HugeiconsIcon
                    icon={Coins01Icon}
                    size={14}
                    className="text-muted-foreground"
                  />
                  <span>Session Economics</span>
                </h3>
                <span className="text-[11px] font-mono text-muted-foreground">
                  {telemetry.turnLedger.length} turns recorded
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <div className="rounded-xl border border-border/60 bg-muted/20 p-3 transition-colors">
                  <div className="text-[11px] font-medium text-muted-foreground">
                    Total Spend
                  </div>
                  <div className="mt-1 font-mono text-lg font-bold tracking-tight text-foreground">
                    {formatUsd(telemetry.totalCostUsd)}
                  </div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground">
                    {telemetry.unpricedCalls > 0 ? (
                      <span className="text-amber-600 dark:text-amber-400 font-medium">
                        {telemetry.unpricedCalls} unpriced call(s)
                      </span>
                    ) : (
                      <span>Attributed cost</span>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-border/60 bg-muted/20 p-3 transition-colors">
                  <div className="text-[11px] font-medium text-muted-foreground">
                    Total Tokens
                  </div>
                  <div className="mt-1 font-mono text-lg font-bold tracking-tight text-foreground">
                    {compactTokens(telemetry.totalTokens)}
                  </div>
                  <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                    {compactTokens(telemetry.totalInputTokens)} in /{" "}
                    {compactTokens(telemetry.outputTokens)} out
                  </div>
                </div>

                <div className="rounded-xl border border-border/60 bg-muted/20 p-3 transition-colors">
                  <div className="text-[11px] font-medium text-muted-foreground">
                    Cache Hit Rate
                  </div>
                  <div className="mt-1 font-mono text-lg font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                    {formatPercent(telemetry.cacheHitRate)}
                  </div>
                  <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                    {compactTokens(telemetry.cachedInputTokens)} cached
                  </div>
                </div>

                <div className="rounded-xl border border-border/60 bg-muted/20 p-3 transition-colors">
                  <div className="text-[11px] font-medium text-muted-foreground">
                    Net Savings
                  </div>
                  <div className="mt-1 font-mono text-lg font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                    {telemetry.cacheSavingsUsd > 0
                      ? `+${formatUsd(telemetry.cacheSavingsUsd)}`
                      : formatUsd(telemetry.cacheSavingsUsd)}
                  </div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground">
                    vs uncached baseline
                  </div>
                </div>
              </div>

              {/* Net cache savings explanation banner */}
              {telemetry.cacheSavingsUsd > 0 ? (
                <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <HugeiconsIcon
                      icon={SparklesIcon}
                      size={14}
                      className="shrink-0"
                    />
                    <span>
                      Prompt caching saved{" "}
                      <strong className="font-mono">
                        {formatUsd(telemetry.cacheSavingsUsd)}
                      </strong>{" "}
                      ({formatPercent(telemetry.cacheHitRate)} read efficiency)
                    </span>
                  </span>
                </div>
              ) : telemetry.cacheCreationInputTokens > 0 ? (
                <div className="rounded-lg bg-teal-500/10 border border-teal-500/20 px-3 py-2 text-xs text-teal-700 dark:text-teal-300 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <HugeiconsIcon
                      icon={Alert02Icon}
                      size={14}
                      className="shrink-0"
                    />
                    <span>
                      KV Cache priming investment:{" "}
                      <strong className="font-mono">
                        {formatUsd(Math.abs(telemetry.cacheSavingsUsd))}
                      </strong>{" "}
                      ({compactTokens(telemetry.cacheCreationInputTokens)} write
                      tokens)
                    </span>
                  </span>
                </div>
              ) : null}

              {/* Token Composition Bar & Legend */}
              <div className="space-y-3 rounded-xl border border-border/60 bg-muted/15 p-3.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground">
                    Token Composition
                  </span>
                  <span className="font-mono font-medium text-muted-foreground">
                    {formatTokens(telemetry.totalTokens)} tokens
                  </span>
                </div>

                <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted/60 gap-0.5 p-0.5">
                  {cachedPct > 0 && (
                    <div
                      style={{ width: `${cachedPct}%` }}
                      className="rounded-xs bg-emerald-500 transition-all duration-300"
                      title={`Cached Read: ${compactTokens(telemetry.cachedInputTokens)} (${cachedPct.toFixed(1)}%)`}
                    />
                  )}
                  {uncachedPct > 0 && (
                    <div
                      style={{ width: `${uncachedPct}%` }}
                      className="rounded-xs bg-sky-500 transition-all duration-300"
                      title={`Uncached Prompt: ${compactTokens(telemetry.uncachedInputTokens)} (${uncachedPct.toFixed(1)}%)`}
                    />
                  )}
                  {cacheWritePct > 0 && (
                    <div
                      style={{ width: `${cacheWritePct}%` }}
                      className="rounded-xs bg-teal-400 transition-all duration-300"
                      title={`Cache Write: ${compactTokens(telemetry.cacheCreationInputTokens)} (${cacheWritePct.toFixed(1)}%)`}
                    />
                  )}
                  {outputPct > 0 && (
                    <div
                      style={{ width: `${outputPct}%` }}
                      className="rounded-xs bg-purple-500 transition-all duration-300"
                      title={`Output Completion: ${compactTokens(telemetry.outputTokens - telemetry.reasoningTokens)} (${outputPct.toFixed(1)}%)`}
                    />
                  )}
                  {reasoningPct > 0 && (
                    <div
                      style={{ width: `${reasoningPct}%` }}
                      className="rounded-xs bg-amber-400 transition-all duration-300"
                      title={`Reasoning: ${compactTokens(telemetry.reasoningTokens)} (${reasoningPct.toFixed(1)}%)`}
                    />
                  )}
                </div>

                {/* Structured Legend Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3 pt-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="size-2 rounded-full bg-emerald-500 shrink-0" />
                    <span className="truncate">Cache Read</span>
                    <span className="ml-auto font-mono text-[11px] tabular-nums text-foreground">
                      {compactTokens(telemetry.cachedInputTokens)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="size-2 rounded-full bg-sky-500 shrink-0" />
                    <span className="truncate">Uncached Prompt</span>
                    <span className="ml-auto font-mono text-[11px] tabular-nums text-foreground">
                      {compactTokens(telemetry.uncachedInputTokens)}
                    </span>
                  </div>
                  {telemetry.cacheCreationInputTokens > 0 && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <span className="size-2 rounded-full bg-teal-400 shrink-0" />
                      <span className="truncate">Cache Write</span>
                      <span className="ml-auto font-mono text-[11px] tabular-nums text-foreground">
                        {compactTokens(telemetry.cacheCreationInputTokens)}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="size-2 rounded-full bg-purple-500 shrink-0" />
                    <span className="truncate">Output</span>
                    <span className="ml-auto font-mono text-[11px] tabular-nums text-foreground">
                      {compactTokens(
                        telemetry.outputTokens - telemetry.reasoningTokens,
                      )}
                    </span>
                  </div>
                  {telemetry.reasoningTokens > 0 && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <span className="size-2 rounded-full bg-amber-400 shrink-0" />
                      <span className="truncate">Reasoning</span>
                      <span className="ml-auto font-mono text-[11px] tabular-nums text-foreground">
                        {compactTokens(telemetry.reasoningTokens)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* SECTION B: Context Window Pressure */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <HugeiconsIcon
                  icon={FlashIcon}
                  size={14}
                  className="text-muted-foreground"
                />
                <span>Context Window Capacity</span>
              </h3>

              <div className="rounded-xl border border-border/60 bg-muted/15 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    Latest Step Footprint
                  </span>
                  <span className="font-mono font-medium text-foreground">
                    {formatTokens(telemetry.contextPressure.lastTotalOccupancy)}{" "}
                    tokens
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                  <span>
                    Prompt:{" "}
                    {compactTokens(
                      telemetry.contextPressure.lastStepPromptTokens,
                    )}
                  </span>
                  <span>
                    Completion:{" "}
                    {compactTokens(
                      telemetry.contextPressure.lastStepCompletionTokens,
                    )}
                  </span>
                </div>

                {telemetry.contextPressure.messagesDropped > 0 && (
                  <div className="rounded-lg bg-amber-500/10 border border-amber-500/25 p-2.5 text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2">
                    <HugeiconsIcon
                      icon={Alert02Icon}
                      size={14}
                      className="shrink-0"
                    />
                    <span>
                      Sliding window active:{" "}
                      <strong>
                        {telemetry.contextPressure.messagesDropped}
                      </strong>{" "}
                      older message(s) compacted to maintain context boundary.
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* SECTION C: Models & Providers Used */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <HugeiconsIcon
                  icon={CpuIcon}
                  size={14}
                  className="text-muted-foreground"
                />
                <span>Active Models ({telemetry.modelsUsed.length})</span>
              </h3>

              <div className="divide-y divide-border/60 rounded-xl border border-border/60 bg-muted/10">
                {telemetry.modelsUsed.length === 0 ? (
                  <div className="p-4 text-xs text-muted-foreground text-center">
                    No model calls recorded in this session yet.
                  </div>
                ) : (
                  telemetry.modelsUsed.map((m) => (
                    <div
                      key={`${m.provider}:${m.model}:${m.effort ?? ""}`}
                      className="p-3.5 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="rounded-lg bg-background p-1 border border-border/40 shrink-0">
                          <ProviderLogo provider={m.provider} size={16} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 font-medium text-xs text-foreground truncate">
                            <span>{m.model}</span>
                            {m.effort && (
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1 py-0 font-normal"
                              >
                                {m.effort}
                              </Badge>
                            )}
                          </div>
                          <div className="text-[11px] font-mono text-muted-foreground">
                            {m.calls} {m.calls === 1 ? "call" : "calls"} ·{" "}
                            {compactTokens(m.inputTokens)} in /{" "}
                            {compactTokens(m.outputTokens)} out
                            {m.cacheHitRate !== null &&
                              ` · ${formatPercent(m.cacheHitRate)} cached`}
                          </div>
                        </div>
                      </div>
                      <div className="font-mono text-xs font-semibold text-foreground text-right shrink-0">
                        {formatUsd(m.costUsd)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* SECTION D: Turn-by-Turn & Step-by-Step Call Audit Ledger */}
            <div className="space-y-3 pb-2">
              <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <HugeiconsIcon
                  icon={DatabaseIcon}
                  size={14}
                  className="text-muted-foreground"
                />
                <span>
                  Call Audit Ledger ({telemetry.turnLedger.length} turns)
                </span>
              </h3>

              <div className="space-y-2">
                {telemetry.turnLedger.length === 0 ? (
                  <div className="rounded-xl border border-border/60 bg-muted/10 p-4 text-xs text-muted-foreground text-center">
                    No turn history available yet.
                  </div>
                ) : (
                  telemetry.turnLedger.map((turn) => {
                    const isExpanded = Boolean(expandedTurns[turn.turnId])
                    return (
                      <div
                        key={turn.turnId}
                        className="rounded-xl border border-border/60 bg-muted/10 overflow-hidden transition-colors"
                      >
                        <button
                          type="button"
                          onClick={() => toggleTurn(turn.turnId)}
                          className="w-full p-3 flex items-center justify-between text-left hover:bg-muted/40 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <HugeiconsIcon
                              icon={
                                isExpanded ? ArrowDown01Icon : ArrowRight01Icon
                              }
                              size={14}
                              className="text-muted-foreground"
                            />
                            <span className="font-medium text-xs text-foreground">
                              Turn #{turn.turnIndex}
                            </span>
                            {turn.isStreaming && (
                              <Badge
                                variant="secondary"
                                className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono"
                              >
                                Active
                              </Badge>
                            )}
                            <span className="inline-flex items-center gap-1 rounded bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground font-mono">
                              <HugeiconsIcon icon={Layers01Icon} size={10} />
                              <span>
                                {turn.calls.length}{" "}
                                {turn.calls.length === 1 ? "step" : "steps"}
                              </span>
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-xs font-mono">
                            <span className="text-muted-foreground">
                              {compactTokens(
                                turn.totalInputTokens + turn.totalOutputTokens,
                              )}{" "}
                              tok
                            </span>
                            <span className="font-semibold text-foreground">
                              {formatUsd(turn.totalCostUsd)}
                            </span>
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="border-t border-border/60 bg-background/60 divide-y divide-border/40 p-1">
                            {turn.calls.map((call, idx) => (
                              <div
                                key={call.callId || idx}
                                className="p-3 text-xs space-y-1.5"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <Badge
                                      variant={
                                        call.status === "succeeded"
                                          ? "outline"
                                          : "destructive"
                                      }
                                      className="text-[10px] px-1.5 py-0 font-mono uppercase"
                                    >
                                      Step {call.step}
                                    </Badge>
                                    <span className="font-medium text-foreground">
                                      {call.model}
                                    </span>
                                    {call.effort && (
                                      <span className="rounded bg-muted/60 px-1 py-0 text-[10px] text-muted-foreground font-mono">
                                        {call.effort}
                                      </span>
                                    )}
                                  </div>
                                  <span className="font-mono text-xs font-semibold text-foreground">
                                    {formatUsd(call.costBreakdown?.total_usd)}
                                  </span>
                                </div>

                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground font-mono">
                                  <span>
                                    In: {compactTokens(call.inputTokens)} (
                                    {compactTokens(call.cachedInputTokens)}{" "}
                                    cached)
                                  </span>
                                  <span>
                                    Out: {compactTokens(call.outputTokens)}
                                  </span>
                                  {call.reasoningTokens > 0 && (
                                    <span className="text-amber-600 dark:text-amber-400">
                                      Reasoning:{" "}
                                      {compactTokens(call.reasoningTokens)}
                                    </span>
                                  )}
                                  {call.durationMs !== null && (
                                    <span className="flex items-center gap-1">
                                      <HugeiconsIcon
                                        icon={Clock01Icon}
                                        size={11}
                                      />
                                      <span>{formatMs(call.durationMs)}</span>
                                    </span>
                                  )}
                                  {call.ttftMs !== null && (
                                    <span>TTFT: {formatMs(call.ttftMs)}</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
