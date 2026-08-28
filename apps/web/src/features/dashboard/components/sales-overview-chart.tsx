import { Badge } from "@workspace/ui/components/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@workspace/ui/components/chart"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

const chartData = [
  { month: "Jan", expense: 31, profit: 31, earning: 31 },
  { month: "Feb", expense: 83, profit: 83, earning: 83 },
  { month: "Mar", expense: 53, profit: 53, earning: 53 },
  { month: "Apr", expense: 36, profit: 36, earning: 36 },
  { month: "May", expense: 64, profit: 64, earning: 64 },
  { month: "Jun", expense: 47, profit: 47, earning: 47 },
  { month: "Jul", expense: 95, profit: 95, earning: 95 },
  { month: "Aug", expense: 69, profit: 69, earning: 69 },
  { month: "Sep", expense: 29, profit: 29, earning: 29 },
  { month: "Oct", expense: 73, profit: 73, earning: 73 },
  { month: "Nov", expense: 27, profit: 27, earning: 27 },
  { month: "Dec", expense: 53, profit: 53, earning: 53 },
]

const chartConfig = {
  earning: {
    label: "Earning",
    color: "var(--chart-1)",
  },
  profit: {
    label: "Profit",
    color: "var(--chart-2)",
  },
  expense: {
    label: "Expense",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig

const LEGEND_ITEMS = [
  { id: "earning", title: "Earning", color: "bg-[var(--chart-1)]" },
  { id: "profit", title: "Profit", color: "bg-[var(--chart-2)]" },
  { id: "expense", title: "Expense", color: "bg-[var(--chart-3)]" },
]

export function SalesOverviewChart() {
  return (
    <Card className="w-full">
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-base font-semibold">
            Sales Overview
          </CardTitle>
          <div className="mt-1 flex items-center gap-2">
            <span className="font-semibold text-2xl tracking-tight text-card-foreground">
              $386.53K
            </span>
            <Badge
              variant="secondary"
              className="bg-primary/10 font-mono text-xs text-primary"
            >
              +18%
            </Badge>
            <span className="text-xs text-muted-foreground">vs last year</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {LEGEND_ITEMS.map((item) => (
            <div key={item.id} className="flex items-center gap-1.5">
              <span className={`size-2.5 rounded-full ${item.color}`} />
              <span className="text-xs text-muted-foreground">
                {item.title}
              </span>
            </div>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[280px] w-full">
          <BarChart accessibilityLayer data={chartData}>
            <CartesianGrid
              vertical={false}
              strokeDasharray="3 3"
              className="stroke-border/40"
            />
            <XAxis
              dataKey="month"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tickFormatter={(value: string) => value.slice(0, 3)}
              className="text-xs"
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              className="text-xs"
              tickFormatter={(value: number) => `$${value}k`}
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
            />
            <ChartTooltip content={<ChartTooltipContent hideLabel />} />
            <Bar
              dataKey="expense"
              stackId="sales"
              fill="var(--color-expense)"
              radius={[0, 0, 4, 4]}
              barSize={20}
            />
            <Bar
              dataKey="profit"
              stackId="sales"
              fill="var(--color-profit)"
              radius={[0, 0, 0, 0]}
              barSize={20}
            />
            <Bar
              dataKey="earning"
              stackId="sales"
              fill="var(--color-earning)"
              radius={[4, 4, 0, 0]}
              barSize={20}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
