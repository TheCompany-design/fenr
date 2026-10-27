import {
  Alert02Icon,
  Coins01Icon,
  CpuIcon,
  DatabaseIcon,
  FlashIcon,
  InformationCircleIcon,
  Layers01Icon,
  Loading03Icon,
  RefreshIcon,
  Shield01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useQuery } from "@tanstack/react-query"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { ScrollArea, ScrollBar } from "@workspace/ui/components/scroll-area"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { cn } from "@workspace/ui/lib/utils"
import { useState } from "react"
import { ProviderLogo } from "@/components/providers/provider-logo"
import { usageSummaryQueryOptions } from "@/features/nabu"

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

const SKELETON_CARDS = ["kpi-1", "kpi-2", "kpi-3", "kpi-4", "kpi-5"] as const

export function UsageDashboard() {
  const [days, setDays] = useState<number>(30)
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery(
    usageSummaryQueryOptions(days),
  )

  const totals = data?.totals
  const breakdown = totals?.cost_breakdown
  const totalCost = breakdown?.total_usd ?? totals?.cost_usd ?? 0
  const totalTokens = (totals?.input_tokens ?? 0) + (totals?.output_tokens ?? 0)

  // 5-part cost percentages
  const costDenom = totalCost > 0 ? totalCost : 1
  const uncachedCost =
    (breakdown?.uncached_input_usd ?? 0) + (breakdown?.tool_use_input_usd ?? 0)
  const inputCostPct = (uncachedCost / costDenom) * 100
  const outputCostPct = ((breakdown?.output_usd ?? 0) / costDenom) * 100
  const cacheReadCostPct = ((breakdown?.cache_read_usd ?? 0) / costDenom) * 100
  const cacheWriteCostPct =
    ((breakdown?.cache_creation_usd ?? 0) / costDenom) * 100
  const reasoningCostPct = ((breakdown?.reasoning_usd ?? 0) / costDenom) * 100

  const isForbidden =
    isError &&
    (error?.message?.toLowerCase().includes("administrator") ||
      error?.message?.toLowerCase().includes("forbidden") ||
      error?.message?.toLowerCase().includes("403") ||
      (error as { status?: number })?.status === 403)

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {/* Header with time range selector */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Usage & Cost Analytics
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Aggregated token consumption, prompt cache economics, and model
            spending across workspace sessions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-border/70 bg-muted/30 p-0.5 text-xs">
            {[7, 14, 30, 90].map((windowDays) => (
              <button
                key={windowDays}
                type="button"
                onClick={() => setDays(windowDays)}
                className={cn(
                  "rounded-md px-2.5 py-1 font-medium transition-colors cursor-pointer",
                  days === windowDays
                    ? "bg-background text-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {windowDays}d
              </button>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-8 w-8 p-0"
            title="Refresh analytics"
          >
            <HugeiconsIcon
              icon={isFetching ? Loading03Icon : RefreshIcon}
              size={14}
              className={isFetching ? "animate-spin" : ""}
            />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {SKELETON_CARDS.map((key) => (
            <div
              key={key}
              className="h-24 animate-pulse rounded-xl border border-border/40 bg-muted/20"
            />
          ))}
        </div>
      ) : isForbidden ? (
        <Card className="border-border/60 bg-muted/10">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center max-w-md mx-auto">
            <div className="flex size-12 items-center justify-center rounded-2xl border border-border/60 bg-muted/40 text-muted-foreground mb-4">
              <HugeiconsIcon icon={Shield01Icon} size={24} />
            </div>
            <h3 className="text-base font-semibold text-foreground">
              Workspace Administrator Access Required
            </h3>
            <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
              Usage and financial billing analytics are restricted to workspace
              administrators and owners. Contact your workspace administrator to
              view or manage aggregated model spend.
            </p>
          </CardContent>
        </Card>
      ) : isError || !totals ? (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex items-center justify-between p-4 text-xs text-destructive">
            <div className="flex items-center gap-2.5">
              <HugeiconsIcon
                icon={Alert02Icon}
                size={18}
                className="shrink-0"
              />
              <div>
                <p className="font-medium text-foreground">
                  Unable to load usage data
                </p>
                <p className="text-muted-foreground text-[11px] mt-0.5">
                  {error?.message ||
                    "Check that the Nabu service is healthy and reachable."}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="h-7 text-xs"
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Executive KPI Cards */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {/* Total Spend */}
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4 transition-colors hover:bg-muted/30">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium">Total Spend</span>
                <HugeiconsIcon icon={Coins01Icon} size={15} />
              </div>
              <div className="mt-2 font-mono text-2xl font-bold tracking-tight tabular-nums text-foreground">
                {formatUsd(totalCost)}
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                {totals.unpriced_calls > 0 ? (
                  <Badge variant="outline" className="text-[10px] px-1 py-0">
                    {totals.unpriced_calls} unpriced
                  </Badge>
                ) : (
                  <span>Pricing engine snapshot</span>
                )}
              </div>
            </div>

            {/* Cache Savings */}
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4 transition-colors hover:bg-muted/30">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium">Cache Savings</span>
                <HugeiconsIcon
                  icon={Tick02Icon}
                  size={15}
                  className="text-emerald-500"
                />
              </div>
              <div className="mt-2 font-mono text-2xl font-bold tracking-tight tabular-nums text-emerald-600 dark:text-emerald-400">
                {formatUsd(breakdown?.cache_savings_usd ?? 0)}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                Saved via prompt caching
              </div>
            </div>

            {/* Total Tokens */}
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4 transition-colors hover:bg-muted/30">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium">Total Tokens</span>
                <HugeiconsIcon icon={CpuIcon} size={15} />
              </div>
              <div className="mt-2 font-mono text-2xl font-bold tracking-tight tabular-nums text-foreground">
                {compactTokens(totalTokens)}
              </div>
              <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                {compactTokens(totals.input_tokens)} in /{" "}
                {compactTokens(totals.output_tokens)} out
              </div>
            </div>

            {/* Cache Hit Rate */}
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4 transition-colors hover:bg-muted/30">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium">Cache Hit Rate</span>
                <HugeiconsIcon icon={DatabaseIcon} size={15} />
              </div>
              <div className="mt-2 font-mono text-2xl font-bold tracking-tight tabular-nums text-foreground">
                {formatPercent(totals.cache_hit_rate)}
              </div>
              <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                {compactTokens(totals.cached_input_tokens)} cached tokens
              </div>
            </div>

            {/* Total Calls */}
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4 transition-colors hover:bg-muted/30">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium">Model Calls</span>
                <HugeiconsIcon icon={FlashIcon} size={15} />
              </div>
              <div className="mt-2 font-mono text-2xl font-bold tracking-tight tabular-nums text-foreground">
                {totals.calls.toLocaleString()}
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                {totals.failed_calls > 0 ? (
                  <span className="text-destructive font-medium">
                    {totals.failed_calls} failed
                  </span>
                ) : (
                  <span>100% successful</span>
                )}
              </div>
            </div>
          </div>

          {/* 5-part Cost Breakdown Card */}
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <HugeiconsIcon
                    icon={Layers01Icon}
                    size={16}
                    className="text-muted-foreground"
                  />
                  <span>5-Part Cost Architecture</span>
                </CardTitle>
                <span className="font-mono text-xs font-medium text-muted-foreground">
                  {formatUsd(totalCost)} total
                </span>
              </div>
              <CardDescription className="text-xs">
                Micro-accounting across uncached inputs, cached reads, cache
                writes, output generation, and reasoning tokens.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {/* Stacked visual distribution bar */}
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted/60 gap-0.5 p-0.5">
                {inputCostPct > 0 && (
                  <div
                    style={{ width: `${inputCostPct}%` }}
                    className="rounded-xs bg-sky-500 transition-all duration-300"
                    title={`Uncached Prompt: ${formatUsd(uncachedCost)} (${Math.round(inputCostPct)}%)`}
                  />
                )}
                {cacheReadCostPct > 0 && (
                  <div
                    style={{ width: `${cacheReadCostPct}%` }}
                    className="rounded-xs bg-emerald-500 transition-all duration-300"
                    title={`Cache Read: ${formatUsd(breakdown?.cache_read_usd)} (${Math.round(cacheReadCostPct)}%)`}
                  />
                )}
                {cacheWriteCostPct > 0 && (
                  <div
                    style={{ width: `${cacheWriteCostPct}%` }}
                    className="rounded-xs bg-teal-400 transition-all duration-300"
                    title={`Cache Write: ${formatUsd(breakdown?.cache_creation_usd)} (${Math.round(cacheWriteCostPct)}%)`}
                  />
                )}
                {outputCostPct > 0 && (
                  <div
                    style={{ width: `${outputCostPct}%` }}
                    className="rounded-xs bg-purple-500 transition-all duration-300"
                    title={`Output Completion: ${formatUsd(breakdown?.output_usd)} (${Math.round(outputCostPct)}%)`}
                  />
                )}
                {reasoningCostPct > 0 && (
                  <div
                    style={{ width: `${reasoningCostPct}%` }}
                    className="rounded-xs bg-amber-400 transition-all duration-300"
                    title={`Reasoning: ${formatUsd(breakdown?.reasoning_usd)} (${Math.round(reasoningCostPct)}%)`}
                  />
                )}
              </div>

              {/* Cost categories grid */}
              <div className="grid grid-cols-2 gap-2.5 text-xs sm:grid-cols-5">
                <div className="rounded-lg border border-border/50 bg-muted/15 p-2.5">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="size-2 rounded-full bg-sky-500 shrink-0" />
                    <span className="truncate">Uncached Prompt</span>
                  </div>
                  <div className="mt-1 font-mono font-semibold tabular-nums text-foreground">
                    {formatUsd(uncachedCost)}
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground">
                    {compactTokens(totals.uncached_input_tokens)} tokens
                  </div>
                </div>

                <div className="rounded-lg border border-border/50 bg-muted/15 p-2.5">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="size-2 rounded-full bg-emerald-500 shrink-0" />
                    <span className="truncate">Cache Read</span>
                  </div>
                  <div className="mt-1 font-mono font-semibold tabular-nums text-foreground">
                    {formatUsd(breakdown?.cache_read_usd ?? 0)}
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground">
                    {compactTokens(totals.cached_input_tokens)} tokens
                  </div>
                </div>

                <div className="rounded-lg border border-border/50 bg-muted/15 p-2.5">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="size-2 rounded-full bg-teal-400 shrink-0" />
                    <span className="truncate">Cache Write</span>
                  </div>
                  <div className="mt-1 font-mono font-semibold tabular-nums text-foreground">
                    {formatUsd(breakdown?.cache_creation_usd ?? 0)}
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground">
                    {compactTokens(totals.cache_creation_input_tokens)} tokens
                  </div>
                </div>

                <div className="rounded-lg border border-border/50 bg-muted/15 p-2.5">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="size-2 rounded-full bg-purple-500 shrink-0" />
                    <span className="truncate">Output Generation</span>
                  </div>
                  <div className="mt-1 font-mono font-semibold tabular-nums text-foreground">
                    {formatUsd(breakdown?.output_usd ?? 0)}
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground">
                    {compactTokens(totals.output_tokens)} tokens
                  </div>
                </div>

                <div className="rounded-lg border border-border/50 bg-muted/15 p-2.5">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="size-2 rounded-full bg-amber-400 shrink-0" />
                    <span className="truncate">Reasoning</span>
                  </div>
                  <div className="mt-1 font-mono font-semibold tabular-nums text-foreground">
                    {formatUsd(breakdown?.reasoning_usd ?? 0)}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Included in output
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Model Breakdown */}
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">
                  Model Consumption Breakdown
                </CardTitle>
                <span className="font-mono text-xs text-muted-foreground">
                  {data.by_model.length} models active
                </span>
              </div>
              <CardDescription className="text-xs">
                Per-model calls, token volumes, latencies, and billing
                attribution.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 sm:p-6 sm:pt-0">
              {data.by_model.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  No model calls recorded in this time window.
                </div>
              ) : (
                <ScrollArea className="w-full whitespace-nowrap">
                  <Table>
                    <TableHeader>
                      <TableRow className="text-[11px] border-border/60">
                        <TableHead>Model</TableHead>
                        <TableHead className="text-right">Calls</TableHead>
                        <TableHead className="text-right">Input</TableHead>
                        <TableHead className="text-right">Output</TableHead>
                        <TableHead className="text-right">Cached %</TableHead>
                        <TableHead className="text-right">
                          Mean Latency
                        </TableHead>
                        <TableHead className="text-right">Total Cost</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.by_model.map((m) => {
                        const mCachedPct =
                          m.input_tokens > 0
                            ? (m.cached_input_tokens / m.input_tokens) * 100
                            : 0
                        return (
                          <TableRow
                            key={`${m.provider}:${m.model}`}
                            className="text-xs border-border/40 hover:bg-muted/30"
                          >
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <ProviderLogo
                                  provider={m.provider}
                                  className="size-4 shrink-0"
                                />
                                <span className="font-mono text-[11px] text-foreground">
                                  {m.model}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-mono tabular-nums">
                              {m.calls.toLocaleString()}
                              {m.failed_calls > 0 && (
                                <span className="ml-1 text-[10px] text-destructive">
                                  ({m.failed_calls} err)
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono tabular-nums">
                              {compactTokens(m.input_tokens)}
                            </TableCell>
                            <TableCell className="text-right font-mono tabular-nums">
                              {compactTokens(m.output_tokens)}
                            </TableCell>
                            <TableCell className="text-right font-mono tabular-nums">
                              {Math.round(mCachedPct)}%
                            </TableCell>
                            <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                              {formatMs(m.mean_duration_ms)}
                            </TableCell>
                            <TableCell className="text-right font-mono font-medium tabular-nums text-foreground">
                              {formatUsd(
                                m.cost_breakdown?.total_usd ?? m.cost_usd,
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {/* Daily Trends */}
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">
                  Daily Spend & Token Activity
                </CardTitle>
                <span className="font-mono text-xs text-muted-foreground">
                  {data.by_day.length} days
                </span>
              </div>
              <CardDescription className="text-xs">
                Chronological ledger of workspace consumption over the selected
                period.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 sm:p-6 sm:pt-0">
              {data.by_day.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  No daily activity recorded in this period.
                </div>
              ) : (
                <ScrollArea className="w-full whitespace-nowrap">
                  <Table>
                    <TableHeader>
                      <TableRow className="text-[11px] border-border/60">
                        <TableHead>Day</TableHead>
                        <TableHead className="text-right">Calls</TableHead>
                        <TableHead className="text-right">
                          Input Tokens
                        </TableHead>
                        <TableHead className="text-right">
                          Output Tokens
                        </TableHead>
                        <TableHead className="text-right">Spend</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.by_day.map((day) => (
                        <TableRow
                          key={day.day}
                          className="text-xs border-border/40 hover:bg-muted/30"
                        >
                          <TableCell className="font-mono text-[11px] text-foreground">
                            {day.day}
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums">
                            {day.calls.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums">
                            {compactTokens(day.input_tokens)}
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums">
                            {compactTokens(day.output_tokens)}
                          </TableCell>
                          <TableCell className="text-right font-mono font-medium tabular-nums text-foreground">
                            {formatUsd(
                              day.cost_breakdown?.total_usd ?? day.cost_usd,
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {/* Context Pressure Footprint */}
          {(data.context.truncated_calls > 0 ||
            data.context.messages_dropped > 0) && (
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4">
              <div className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5 mb-1.5">
                <HugeiconsIcon icon={InformationCircleIcon} size={15} />
                <span>Context Window Pressure Detected</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                During this window, {data.context.truncated_calls} calls
                experienced context truncation and{" "}
                {data.context.messages_dropped} messages were compacted to stay
                within provider context limits.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
