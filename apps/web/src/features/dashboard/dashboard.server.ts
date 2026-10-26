import { demoEndpoints } from "@/lib/http"
import { executeRequest } from "@/lib/http/client.server"
import type { DashboardPost } from "@/lib/schemas/dashboard"

export async function fetchDashboardPosts(): Promise<DashboardPost[]> {
  return executeRequest(demoEndpoints.dashboardPosts)
}
