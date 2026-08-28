import { MoreVerticalIcon } from "@hugeicons/core-free-icons"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Separator } from "@workspace/ui/components/separator"

export interface CountrySaleItem {
  id: string
  flag: string
  title: string
  country: string
  amount: string
  growth: string
  isPositive: boolean
}

const DEFAULT_SALES: CountrySaleItem[] = [
  {
    id: "us",
    flag: "🇺🇸",
    title: "PayPal Transfer",
    country: "United States",
    amount: "$8,567k",
    growth: "+4.7%",
    isPositive: true,
  },
  {
    id: "br",
    flag: "🇧🇷",
    title: "Digital Wallet",
    country: "Brazil",
    amount: "$2,415k",
    growth: "-1.7%",
    isPositive: false,
  },
  {
    id: "in",
    flag: "🇮🇳",
    title: "Credit Card",
    country: "India",
    amount: "$865k",
    growth: "+4.7%",
    isPositive: true,
  },
  {
    id: "au",
    flag: "🇦🇺",
    title: "Bank Wire",
    country: "Australia",
    amount: "$745k",
    growth: "-1.7%",
    isPositive: false,
  },
  {
    id: "fr",
    flag: "🇫🇷",
    title: "Direct Debit",
    country: "France",
    amount: "$450k",
    growth: "+4.7%",
    isPositive: true,
  },
]

export function SalesByCountryWidget({
  items = DEFAULT_SALES,
}: {
  items?: CountrySaleItem[]
}) {
  return (
    <Card className="flex flex-col justify-between">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="text-base font-semibold">
            Sales by Countries
          </CardTitle>
          <CardDescription>
            Breakdown by geography and payment type
          </CardDescription>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="ghost" size="icon" className="size-8" />}
          >
            <HugeiconsIcon icon={MoreVerticalIcon} size={16} />
            <span className="sr-only">Actions</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>Export CSV</DropdownMenuItem>
            <DropdownMenuItem>Filter regions</DropdownMenuItem>
            <DropdownMenuItem>View all analytics</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {items.map((item, index) => (
          <div key={item.id}>
            <div className="flex items-center justify-between py-1 text-sm">
              <div className="flex items-center gap-3">
                <span className="flex size-8 items-center justify-center rounded-md bg-muted text-base">
                  {item.flag}
                </span>
                <div>
                  <p className="font-medium leading-none text-card-foreground">
                    {item.amount}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.country} • {item.title}
                  </p>
                </div>
              </div>
              <Badge
                variant={item.isPositive ? "secondary" : "outline"}
                className="font-mono text-xs"
              >
                {item.growth}
              </Badge>
            </div>
            {index < items.length - 1 && <Separator className="mt-3" />}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
