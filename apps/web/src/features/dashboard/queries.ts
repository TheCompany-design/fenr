import { queryOptions } from "@tanstack/react-query"
import type { DashboardPost } from "@/lib/schemas/dashboard"

import { getDashboardPostsFn } from "./dashboard.functions"

export const dashboardPostsQueryOptions = () =>
  queryOptions({
    queryKey: ["dashboard", "posts"] as const,
    queryFn: (): Promise<DashboardPost[]> => getDashboardPostsFn(),
    staleTime: 1000 * 60,
  })
