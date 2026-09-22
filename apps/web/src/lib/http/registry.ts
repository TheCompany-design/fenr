/**
 * Central Outbound HTTP Service & Endpoint Registry.
 *
 * Exposes all external services and typed endpoint definitions in one searchable location.
 * Every endpoint explicitly defines whether it requires an authenticated JWT or is public.
 */

import {
  type DashboardPost,
  dashboardPostsSchema,
} from "@/lib/schemas/dashboard"
import {
  type AgentTaskResult,
  agentTaskResultSchema,
  type CreateAgentTaskInput,
  createAgentTaskInputSchema,
  type NabuSystemStatus,
  nabuSystemStatusSchema,
  type ReconciliationMatchInput,
  type ReconciliationMatchResult,
  reconciliationMatchInputSchema,
  reconciliationMatchResultSchema,
} from "@/lib/schemas/nabu"

import { defineAuthenticatedEndpoint, definePublicEndpoint } from "./types"

export const SERVICES = {
  NABU: "nabu",
  DEMO: "demo",
} as const

export type ServiceName = (typeof SERVICES)[keyof typeof SERVICES]

/**
 * Nabu Agent Runtime Endpoints.
 * All Nabu endpoints require Better Auth JWT authentication with audience "nabu".
 */
export const nabuEndpoints = {
  systemStatus: defineAuthenticatedEndpoint<void, NabuSystemStatus>({
    id: "nabu.system-status",
    service: SERVICES.NABU,
    audience: "nabu",
    method: "GET",
    path: "/api/v1/system/status",
    responseSchema: nabuSystemStatusSchema,
    timeoutMs: 10_000,
    description:
      "Get health, engine version, and database connectivity status from thebookofnabu.",
  }),

  matchReconciliation: defineAuthenticatedEndpoint<
    ReconciliationMatchInput,
    ReconciliationMatchResult
  >({
    id: "nabu.reconciliation.match",
    service: SERVICES.NABU,
    audience: "nabu",
    method: "POST",
    path: "/api/v1/reconciliation/match",
    inputSchema: reconciliationMatchInputSchema,
    responseSchema: reconciliationMatchResultSchema,
    timeoutMs: 15_000,
    description:
      "Submit an inflow payment transaction for deterministic reconciliation matching.",
  }),

  dispatchTask: defineAuthenticatedEndpoint<
    CreateAgentTaskInput,
    AgentTaskResult
  >({
    id: "nabu.agent.dispatch-task",
    service: SERVICES.NABU,
    audience: "nabu",
    method: "POST",
    path: "/api/v1/agent/tasks",
    inputSchema: createAgentTaskInputSchema,
    responseSchema: agentTaskResultSchema,
    timeoutMs: 30_000,
    description: "Dispatch an autonomous agent task turn to thebookofnabu.",
  }),
} as const

/**
 * Demo / Third-party Endpoints.
 * Explicitly public; never sent private JWT tokens or session headers.
 */
export const demoEndpoints = {
  dashboardPosts: definePublicEndpoint<void, DashboardPost[]>({
    id: "demo.dashboard-posts",
    service: SERVICES.DEMO,
    method: "GET",
    path: "https://jsonplaceholder.typicode.com/posts?_limit=3",
    responseSchema: dashboardPostsSchema,
    timeoutMs: 8_000,
    description:
      "Fetch mock dashboard sample posts from public JSONPlaceholder API.",
  }),
} as const

export const requestRegistry = {
  nabu: nabuEndpoints,
  demo: demoEndpoints,
} as const
