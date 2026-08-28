import { EarningReportChart } from "./earning-report-chart"
import { SalesByCountryWidget } from "./sales-by-country-widget"
import { SalesOverviewChart } from "./sales-overview-chart"
import { StatisticsCards } from "./statistics-cards"
import { TopProductsTable } from "./top-products-table"

export function DashboardOverview() {
  return (
    <div className="flex flex-col gap-6">
      {/* 1. Metric Cards */}
      <StatisticsCards />

      {/* 2. Charts Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SalesOverviewChart />
        </div>
        <div className="lg:col-span-1">
          <EarningReportChart />
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
