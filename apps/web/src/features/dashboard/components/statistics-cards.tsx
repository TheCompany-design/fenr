import {
  ArrowRight01Icon,
  Calendar03Icon,
  ShoppingBag01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Separator } from "@workspace/ui/components/separator"
import { cn } from "@workspace/ui/lib/utils"

export type DashboardMetric = {
  label: string
  value: string
  percentage: string
  isPositive?: boolean
}

export type StatItem = {
  title: string
  value: string
  percentage: string
  icon: typeof Calendar03Icon
  isPositive?: boolean
}

const DEFAULT_METRICS: DashboardMetric[] = [
  {
    label: "Earnings",
    value: "$27,850",
    percentage: "+18%",
    isPositive: true,
  },
  {
    label: "Expense",
    value: "$18,453",
    percentage: "-5%",
    isPositive: false,
  },
]

const DEFAULT_SECONDARY_STATS: StatItem[] = [
  {
    title: "Weekly Sales",
    value: "$4,587",
    percentage: "+18%",
    icon: Calendar03Icon,
    isPositive: true,
  },
  {
    title: "Purchase Orders",
    value: "230",
    percentage: "+18%",
    icon: ShoppingBag01Icon,
    isPositive: true,
  },
]

export function StatisticsCards({
  metrics = DEFAULT_METRICS,
  secondaryStats = DEFAULT_SECONDARY_STATS,
}: {
  metrics?: DashboardMetric[]
  secondaryStats?: StatItem[]
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {/* Primary analytics overview */}
      <Card className="col-span-1 flex flex-col justify-between md:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">
            Analytics Overview
          </CardTitle>
          <CardDescription>
            Performance metrics for the current billing cycle
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-6 pt-2">
          {metrics.map((metric, index) => (
            <div key={metric.label} className="flex items-center gap-6">
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  {metric.label}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="font-semibold text-2xl tracking-tight text-card-foreground">
                    {metric.value}
                  </span>
                  <Badge
                    variant={metric.isPositive ? "secondary" : "outline"}
                    className={cn(
                      "font-mono text-xs",
                      metric.isPositive
                        ? "bg-primary/10 text-primary border-transparent"
                        : "bg-destructive/10 text-destructive border-destructive/20",
                    )}
                  >
                    {metric.percentage}
                  </Badge>
                </div>
              </div>
              {index < metrics.length - 1 && (
                <Separator orientation="vertical" className="h-10" />
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Secondary stat cards */}
      {secondaryStats.map((stat) => (
        <Card key={stat.title} className="flex flex-col justify-between">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
            <div className="space-y-1">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-2xl tracking-tight text-card-foreground">
                  {stat.value}
                </span>
                <Badge
                  variant={stat.isPositive ? "secondary" : "outline"}
                  className={cn(
                    "font-mono text-xs",
                    stat.isPositive
                      ? "bg-primary/10 text-primary border-transparent"
                      : "bg-destructive/10 text-destructive border-destructive/20",
                  )}
                >
                  {stat.percentage}
                </Badge>
              </div>
            </div>
            <div className="flex size-9 items-center justify-center rounded-lg bg-muted text-foreground">
              <HugeiconsIcon icon={stat.icon} size={18} />
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <Button
              variant="ghost"
              size="sm"
              className="-ml-2 h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <span>View report</span>
              <HugeiconsIcon icon={ArrowRight01Icon} size={14} />
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
