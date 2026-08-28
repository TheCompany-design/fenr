import { Badge } from "@workspace/ui/components/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@workspace/ui/components/chart"
// react-doctor-disable-next-line react-doctor/prefer-dynamic-import -- dynamically loaded chunk via React.lazy in dashboard-overview
import { Label, type LabelProps, Pie, PieChart } from "recharts"

const chartData = [
  { channel: "Website", share: 60, fill: "var(--chart-1)" },
  { channel: "Marketplace", share: 20, fill: "var(--chart-2)" },
  { channel: "Affiliate", share: 20, fill: "var(--chart-3)" },
]

const chartConfig = {
  share: {
    label: "Share",
  },
  Website: {
    label: "Website",
    color: "var(--chart-1)",
  },
  Marketplace: {
    label: "Marketplace",
    color: "var(--chart-2)",
  },
  Affiliate: {
    label: "Affiliate",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig

const SEGMENTS = [
  {
    id: 1,
    name: "Website",
    dotColor: "bg-[var(--chart-1)]",
    earning: "$18,356",
    growth: "+4.7%",
    isPositive: true,
  },
  {
    id: 2,
    name: "Marketplace",
    dotColor: "bg-[var(--chart-2)]",
    earning: "$4,590",
    growth: "+2.1%",
    isPositive: true,
  },
  {
    id: 3,
    name: "Affiliate",
    dotColor: "bg-[var(--chart-3)]",
    earning: "$4,385",
    growth: "-1.7%",
    isPositive: false,
  },
]

export function EarningReportChart() {
  return (
    <Card className="flex flex-col justify-between">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">
          Earning Reports
        </CardTitle>
        <CardDescription>
          Revenue distribution across sales channels
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-between gap-4">
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square max-h-[220px] w-full"
        >
          <PieChart>
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
            <Pie
              data={chartData}
              dataKey="share"
              nameKey="channel"
              innerRadius={55}
              strokeWidth={4}
              stroke="var(--card)"
            >
              <Label
                content={({ viewBox }: LabelProps) => {
                  if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                    return (
                      <text
                        x={viewBox.cx}
                        y={viewBox.cy}
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) - 8}
                          className="fill-muted-foreground text-xs"
                        >
                          Total
                        </tspan>
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) + 14}
                          className="fill-card-foreground font-semibold text-lg"
                        >
                          $27,850
                        </tspan>
                      </text>
                    )
                  }
                  return null
                }}
              />
            </Pie>
          </PieChart>
        </ChartContainer>

        <div className="flex flex-col gap-2.5">
          {SEGMENTS.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-2">
                <span className={`size-2 rounded-full ${item.dotColor}`} />
                <span className="font-medium text-card-foreground">
                  {item.name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-muted-foreground">
                  {item.earning}
                </span>
                <Badge
                  variant={item.isPositive ? "secondary" : "outline"}
                  className="px-1.5 py-0 font-mono text-[10px]"
                >
                  {item.growth}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
