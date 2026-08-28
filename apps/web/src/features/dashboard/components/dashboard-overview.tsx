import { Skeleton } from "@workspace/ui/components/skeleton"
import { lazy, Suspense } from "react"
import { SalesByCountryWidget } from "./sales-by-country-widget"
import { StatisticsCards } from "./statistics-cards"
import { TopProductsTable } from "./top-products-table"

const SalesOverviewChart = lazy(() =>
  import("./sales-overview-chart").then((m) => ({
    default: m.SalesOverviewChart,
  })),
)

const EarningReportChart = lazy(() =>
  import("./earning-report-chart").then((m) => ({
    default: m.EarningReportChart,
  })),
)

export function DashboardOverview() {
  return (
    <div className="flex flex-col gap-6">
      {/* 1. Metric Cards */}
      <StatisticsCards />

      {/* 2. Charts Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Suspense
            fallback={<Skeleton className="h-[380px] w-full rounded-xl" />}
          >
            <SalesOverviewChart />
          </Suspense>
        </div>
        <div className="lg:col-span-1">
          <Suspense
            fallback={<Skeleton className="h-[380px] w-full rounded-xl" />}
          >
            <EarningReportChart />
          </Suspense>
        </div>
      </div>

      {/* 3. Table & Geographic Breakdown */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TopProductsTable />
        </div>
        <div className="lg:col-span-1">
          <SalesByCountryWidget />
        </div>
      </div>
    </div>
  )
}
