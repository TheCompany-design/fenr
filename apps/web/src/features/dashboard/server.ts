/**
 * Server functions and operations for Dashboard demo data.
 *
 * Exposes type-safe createServerFn endpoints for client consumption.
 * SERVER-ONLY: executed on the Fenr server runtime to prevent leaking
 * server environment variables or database modules into the browser.
 */

import { createServerFn } from "@tanstack/react-start"

import { demoEndpoints, executeRequest } from "@/lib/http"
import type { DashboardPost } from "@/lib/schemas/dashboard"

/**
 * Server-only fetcher for dashboard posts demo data.
 */
export async function fetchDashboardPosts(): Promise<DashboardPost[]> {
  return executeRequest(demoEndpoints.dashboardPosts)
}

export const getDashboardPostsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<DashboardPost[]> => {
    return fetchDashboardPosts()
  },
)
