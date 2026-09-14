import { queryOptions } from "@tanstack/react-query"

import {
  type DashboardPost,
  dashboardPostsSchema,
} from "@/lib/schemas/dashboard"

async function fetchDashboardPosts(): Promise<DashboardPost[]> {
  const response = await fetch(
    "https://jsonplaceholder.typicode.com/posts?_limit=3",
  )
  if (!response.ok) {
    throw new Error(`Failed to fetch dashboard posts: ${response.status}`)
  }

  const parsed = dashboardPostsSchema.safeParse(await response.json())
  if (!parsed.success) {
    throw new Error("Dashboard posts response was invalid")
  }
  return parsed.data
}

export const dashboardPostsQueryOptions = () =>
  queryOptions({
    queryKey: ["dashboard", "posts"] as const,
    queryFn: fetchDashboardPosts,
    staleTime: 1000 * 60,
  })
