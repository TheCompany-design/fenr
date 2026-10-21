import { z } from "zod"
import {
  type DashboardPost,
  dashboardPostsSchema,
} from "@/lib/schemas/dashboard"
import type { ProviderModelsResponse } from "@/lib/schemas/nabu"
import {
  approvalDecisionInputSchema,
  createTenantProviderInputSchema,
  type NabuCapabilities,
  type NabuSystemStatus,
  nabuCapabilitiesSchema,
  nabuSystemStatusSchema,
  providerModelsResponseSchema,
  type TenantProviderList,
  type TenantProviderSummary,
  type TurnItemsResponse,
  tenantProviderListSchema,
  tenantProviderSummarySchema,
  turnItemsResponseSchema,
  type VerifyTenantProviderResponse,
  verifyTenantProviderResponseSchema,
} from "@/lib/schemas/nabu"
import type { TurnItemsInput } from "./types"

import { defineAuthenticatedEndpoint, definePublicEndpoint } from "./types"

const emptyResponseSchema = z.unknown()

const pathOnlyRequestSchema = z.object({
  turnId: z.string().uuid(),
})

const turnItemsQueryInputSchema = z.object({
  turnId: z.string().uuid(),
  after: z.string().uuid().optional(),
  limit: z.number().int().positive().max(200).optional(),
})

const approvalDecisionRequestSchema = approvalDecisionInputSchema.extend({
  turnId: z.string().uuid(),
})
type ApprovalDecisionRequest = z.infer<typeof approvalDecisionRequestSchema>

type CreateTenantProviderRequest = z.infer<
  typeof createTenantProviderInputSchema
>

export const SERVICES = {
  NABU: "nabu",
  DEMO: "demo",
} as const

export type ServiceName = (typeof SERVICES)[keyof typeof SERVICES]

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

  tenantProviders: defineAuthenticatedEndpoint<void, TenantProviderList>({
    id: "nabu.tenant-providers",
    service: SERVICES.NABU,
    audience: "nabu",
    method: "GET",
    path: "/api/v1/providers",
    responseSchema: tenantProviderListSchema,
    timeoutMs: 10_000,
    description: "List the workspace's saved model providers.",
  }),

  createTenantProvider: defineAuthenticatedEndpoint<
    CreateTenantProviderRequest,
    TenantProviderSummary
  >({
    id: "nabu.create-tenant-provider",
    service: SERVICES.NABU,
    audience: "nabu",
    method: "POST",
    path: "/api/v1/providers",
    inputSchema: createTenantProviderInputSchema,
    responseSchema: tenantProviderSummarySchema,
    timeoutMs: 15_000,
    description: "Save another model provider for the workspace.",
  }),

  deleteTenantProvider: defineAuthenticatedEndpoint<
    { readonly id: string },
    unknown
  >({
    id: "nabu.delete-tenant-provider",
    service: SERVICES.NABU,
    audience: "nabu",
    method: "DELETE",
    path: (input) => `/api/v1/providers/${input.id}`,
    responseSchema: emptyResponseSchema,
    timeoutMs: 15_000,
    description: "Remove one of the workspace's saved model providers.",
  }),

  /**
   * Mark one saved provider as the one new conversations start on.
   *
   * `PUT /api/v1/providers/{id}/default`
   *
   * One default per workspace is the runtime's guarantee; this is how a
   * workspace moves it.
   */
  setDefaultTenantProvider: defineAuthenticatedEndpoint<
    { readonly id: string },
    unknown
  >({
    id: "nabu.set-default-tenant-provider",
    service: SERVICES.NABU,
    audience: "nabu",
    method: "PUT",
    path: (input) => `/api/v1/providers/${input.id}/default`,
    responseSchema: emptyResponseSchema,
    timeoutMs: 15_000,
    description: "Mark one saved provider as the workspace's default.",
  }),

  /**
   * Test one of the workspace's saved providers.
   *
   * `POST /api/v1/providers/{id}/verify`
   *
   * The runtime dials, not this service. That is the whole reason the endpoint
   * exists on the far side of the boundary: the process that holds the egress
   * guard and the sealing key is the one that should open the socket, so there
   * is exactly one implementation of "is this endpoint safe to call" rather
   * than two that can drift.
   */
  verifyTenantProvider: defineAuthenticatedEndpoint<
    { readonly id: string },
    VerifyTenantProviderResponse
  >({
    id: "nabu.verify-tenant-provider",
    service: SERVICES.NABU,
    audience: "nabu",
    method: "POST",
    path: (input) => `/api/v1/providers/${input.id}/verify`,
    body: () => undefined,
    responseSchema: verifyTenantProviderResponseSchema,
    timeoutMs: 20_000,
    description:
      "Call one saved provider with its stored credential and report whether it answered.",
  }),

  /**
   * A vendor's model catalogue, read with a credential that is not saved yet.
   *
   * `POST /api/v1/providers/models`
   *
   * The create form dials this so the model is picked from a list rather than
   * typed from memory. The key rides the request body once and is never
   * stored by this call; the runtime dials with it through its egress guard.
   */
  listProviderModels: defineAuthenticatedEndpoint<
    { readonly provider: string; readonly api_key: string },
    ProviderModelsResponse
  >({
    id: "nabu.list-provider-models",
    service: SERVICES.NABU,
    audience: "nabu",
    method: "POST",
    path: () => "/api/v1/providers/models",
    body: (input) => input,
    responseSchema: providerModelsResponseSchema,
    timeoutMs: 20_000,
    description:
      "Read a vendor's model catalogue with a not-yet-saved credential, so the model is a choice rather than a guess.",
  }),

  /**
   * A saved configuration's model catalogue.
   *
   * `GET /api/v1/providers/{id}/models`
   *
   * Same dial, same guard, with the stored credential the runtime holds — the
   * edit path of the same picker.
   */
  savedProviderModels: defineAuthenticatedEndpoint<
    { readonly id: string },
    ProviderModelsResponse
  >({
    id: "nabu.saved-provider-models",
    service: SERVICES.NABU,
    audience: "nabu",
    method: "GET",
    path: (input) => `/api/v1/providers/${input.id}/models`,
    body: () => undefined,
    responseSchema: providerModelsResponseSchema,
    timeoutMs: 20_000,
    description:
      "Read one saved configuration's model catalogue, dialled with its stored credential.",
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
