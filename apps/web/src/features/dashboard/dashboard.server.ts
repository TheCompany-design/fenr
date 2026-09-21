/**
 * Server-only operations for Dashboard demo data.
 *
 * SERVER-ONLY: executed on the Fenr server runtime to prevent leaking
 * server environment variables or database modules into the browser.
 */

import { demoEndpoints } from "@/lib/http"
import { executeRequest } from "@/lib/http/client.server"
import type { DashboardPost } from "@/lib/schemas/dashboard"

/**
 * Server-only fetcher for dashboard posts demo data.
 */
export async function fetchDashboardPosts(): Promise<DashboardPost[]> {
  return executeRequest(demoEndpoints.dashboardPosts)
}
