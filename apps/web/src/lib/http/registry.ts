/**
 * Central Outbound HTTP Service & Endpoint Registry.
 *
 * Exposes all external services and typed endpoint definitions in one searchable location.
 * Every endpoint explicitly defines whether it requires an authenticated JWT or is public.
 */

import { z } from "zod"
import {
  type DashboardPost,
  dashboardPostsSchema,
} from "@/lib/schemas/dashboard"
import {
  approvalDecisionInputSchema,
  type NabuCapabilities,
  type NabuSystemStatus,
  nabuCapabilitiesSchema,
  nabuSystemStatusSchema,
  type TurnItemsResponse,
  turnItemsResponseSchema,
} from "@/lib/schemas/nabu"
import type { TurnItemsInput } from "./types"

import { defineAuthenticatedEndpoint, definePublicEndpoint } from "./types"

/**
 * A response with no body.
 *
 * The runtime answers these endpoints with `202` and nothing to parse, so the
 * schema accepts an absent body rather than demanding an object — validating a
 * body that does not exist would turn every successful call into a failure.
 */
const emptyResponseSchema = z.unknown()

/** A turn identifier plus the paging options the items endpoint accepts. */
const pathOnlyRequestSchema = z.object({
  turnId: z.string().uuid(),
})

const turnItemsQueryInputSchema = z.object({
  turnId: z.string().uuid(),
  after: z.string().uuid().optional(),
  limit: z.number().int().positive().max(200).optional(),
})

/** An approval decision, with the turn that routes it. */
const approvalDecisionRequestSchema = approvalDecisionInputSchema.extend({
  turnId: z.string().uuid(),
})
type ApprovalDecisionRequest = z.infer<typeof approvalDecisionRequestSchema>

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

  /**
   * What a turn may do in this deployment.
   *
   * `GET /api/v1/capabilities`
   */
  capabilities: defineAuthenticatedEndpoint<void, NabuCapabilities>({
    id: "nabu.capabilities",
    service: SERVICES.NABU,
    audience: "nabu",
    method: "GET",
    path: "/api/v1/capabilities",
    responseSchema: nabuCapabilitiesSchema,
    timeoutMs: 10_000,
    description:
      "Report which tools a model may request, how many attempts a turn has, and whether a disconnected client ends the turn.",
  }),

  /**
   * A turn's transcript.
   *
   * `GET /api/v1/threads/{turn_id}/items`
   *
   * The path is a function of the input because the turn is part of the route:
   * turns are addressed by identifier, not through a collection endpoint.
   */
  turnItems: defineAuthenticatedEndpoint<TurnItemsInput, TurnItemsResponse>({
    id: "nabu.turn-items",
    service: SERVICES.NABU,
    audience: "nabu",
    method: "GET",
    path: (input) => `/api/v1/threads/${input.turnId}/items`,
    inputSchema: turnItemsQueryInputSchema,
    responseSchema: turnItemsResponseSchema,
    timeoutMs: 15_000,
    description:
      "Read a turn's completed transcript items, oldest first, paging forward with `after`.",
  }),

  /**
   * Answer a pending approval.
   *
   * `POST /api/v1/threads/{turn_id}/approvals`
   *
   * The runtime refuses a second decision rather than overwriting the first, so
   * retrying this is only safe with the same answer.
   */
  decideApproval: defineAuthenticatedEndpoint<ApprovalDecisionRequest, unknown>(
    {
      id: "nabu.decide-approval",
      service: SERVICES.NABU,
      audience: "nabu",
      method: "POST",
      path: (input) => `/api/v1/threads/${input.turnId}/approvals`,
      inputSchema: approvalDecisionRequestSchema,
      // `turn_id` is a path segment; the runtime reads the decision from the body.
      body: ({ turnId: _routingId, ...body }) => body,
      responseSchema: emptyResponseSchema,
      timeoutMs: 15_000,
      description:
        "Record a human decision on an approval request, resuming the turn if it was suspended.",
    },
  ),

  /**
   * Stop a turn.
   *
   * `POST /api/v1/threads/{turn_id}/cancel`
   */
  cancelTurn: defineAuthenticatedEndpoint<{ turnId: string }, unknown>({
    id: "nabu.cancel-turn",
    service: SERVICES.NABU,
    audience: "nabu",
    method: "POST",
    path: (input) => `/api/v1/threads/${input.turnId}/cancel`,
    inputSchema: pathOnlyRequestSchema,
    body: () => undefined,
    responseSchema: emptyResponseSchema,
    timeoutMs: 15_000,
    description: "Cancel a running or suspended turn.",
  }),

  /**
   * Resume a suspended turn.
   *
   * `POST /api/v1/threads/{turn_id}/resume`
   */
  resumeTurn: defineAuthenticatedEndpoint<{ turnId: string }, unknown>({
    id: "nabu.resume-turn",
    service: SERVICES.NABU,
    audience: "nabu",
    method: "POST",
    path: (input) => `/api/v1/threads/${input.turnId}/resume`,
    inputSchema: pathOnlyRequestSchema,
    body: () => undefined,
    responseSchema: emptyResponseSchema,
    timeoutMs: 15_000,
    description: "Resume a suspended turn after a recorded decision.",
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
