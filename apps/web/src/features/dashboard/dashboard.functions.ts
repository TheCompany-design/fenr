/**
 * Client-callable server functions for Dashboard.
 *
 * Exposes type-safe createServerFn endpoints for client consumption.
 * Handlers delegate to server-only modules so that server transport
 * and credentials are never bundled into the browser.
 */

import { createServerFn } from "@tanstack/react-start"
import type { DashboardPost } from "@/lib/schemas/dashboard"

import { fetchDashboardPosts } from "./dashboard.server"

export const getDashboardPostsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<DashboardPost[]> => {
    return fetchDashboardPosts()
  },
)
