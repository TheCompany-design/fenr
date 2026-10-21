import { createServerFn } from "@tanstack/react-start"
import type { DashboardPost } from "@/lib/schemas/dashboard"

import { fetchDashboardPosts } from "./dashboard.server"

export const getDashboardPostsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<DashboardPost[]> => {
    return fetchDashboardPosts()
  },
)
