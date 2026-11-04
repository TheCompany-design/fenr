import { z } from "zod"
import {
  type DashboardPost,
  dashboardPostsSchema,
} from "@/lib/schemas/dashboard"
import {
  type CatalogResponse,
  catalogResponseSchema,
  connectionCallbackResponseSchema,
  type InitiateConnectionResponse,
  initiateConnectionResponseSchema,
  type ToolkitDetailResponse,
  toolkitDetailResponseSchema,
} from "@/lib/schemas/integrations"
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
  type ThreadUsageResponse,
  type TurnItemsResponse,
  tenantProviderListSchema,
  tenantProviderSummarySchema,
  threadUsageResponseSchema,
  turnItemsResponseSchema,
  type UsageSummaryResponse,
  usageSummaryResponseSchema,
  type VerifyTenantProviderResponse,
  verifyTenantProviderResponseSchema,
} from "@/lib/schemas/nabu"
import type { TurnItemsInput } from "./types"

import { defineAuthenticatedEndpoint, definePublicEndpoint } from "./types"

const emptyResponseSchema = z.unknown()

const pathOnlyRequestSchema = z.object({
  turnId: z.string().uuid(),
})

const threadUsageRequestSchema = z.object({
  threadId: z.string().uuid(),
})

const usageSummaryRequestSchema = z
  .object({
    days: z.number().int().positive().max(366).optional(),
  })
  .optional()

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

  /**
   * Read full session token, timing, and cost usage breakdown for a conversation.
   *
   * `GET /api/v1/threads/{thread_id}/usage`
   */
  threadUsage: defineAuthenticatedEndpoint<
    { threadId: string },
    ThreadUsageResponse
  >({
    id: "nabu.thread-usage",
    service: SERVICES.NABU,
    audience: "nabu",
    method: "GET",
    path: (input) => `/api/v1/threads/${input.threadId}/usage`,
    inputSchema: threadUsageRequestSchema,
    responseSchema: threadUsageResponseSchema,
    timeoutMs: 15_000,
    description: "Read token, timing, and cost usage breakdown for a thread.",
  }),

  /**
   * Aggregate workspace model usage, trends, and attribution across a time window.
   *
   * `GET /api/v1/usage/summary`
   */
  usageSummary: defineAuthenticatedEndpoint<
    { days?: number } | undefined,
    UsageSummaryResponse
  >({
    id: "nabu.usage-summary",
    service: SERVICES.NABU,
    audience: "nabu",
    method: "GET",
    path: (input) =>
      input?.days
        ? `/api/v1/usage/summary?days=${input.days}`
        : "/api/v1/usage/summary",
    inputSchema: usageSummaryRequestSchema,
    responseSchema: usageSummaryResponseSchema,
    timeoutMs: 20_000,
    description:
      "Aggregate workspace model usage, daily spend trends, and actor attribution.",
  }),

  // -------------------------------------------------------------------------
  // Integrations (Composio): catalog, connections, policies, requests.
  // -------------------------------------------------------------------------

  integrationsCatalog: defineAuthenticatedEndpoint<void, CatalogResponse>({
    id: "nabu.integrations-catalog",
    service: SERVICES.NABU,
    audience: "nabu",
    method: "GET",
    path: "/api/v1/integrations/catalog",
    responseSchema: catalogResponseSchema,
    timeoutMs: 15_000,
    description:
      "List the curated integration catalog merged with this workspace's installs, connections, and needs-action items.",
  }),

  integrationsToolkitDetail: defineAuthenticatedEndpoint<
    { readonly toolkitSlug: string },
    ToolkitDetailResponse
  >({
    id: "nabu.integrations-toolkit-detail",
    service: SERVICES.NABU,
    audience: "nabu",
    method: "GET",
    path: (input) => `/api/v1/integrations/catalog/${input.toolkitSlug}`,
    responseSchema: toolkitDetailResponseSchema,
    timeoutMs: 15_000,
    description: "Read one toolkit's detail for the integrations sheet.",
  }),

  updateToolkitConfig: defineAuthenticatedEndpoint<
    {
      readonly toolkitSlug: string
      readonly enabled_for_agents: boolean
      readonly connection_sharing_mode?: string
      readonly workspace_approval_posture?: string
    },
    unknown
  >({
    id: "nabu.integrations-update-toolkit-config",
    service: SERVICES.NABU,
    audience: "nabu",
    method: "PUT",
    path: (input) =>
      `/api/v1/integrations/toolkits/${input.toolkitSlug}/config`,
    body: (input) => ({
      enabled_for_agents: input.enabled_for_agents,
      connection_sharing_mode: input.connection_sharing_mode,
      workspace_approval_posture: input.workspace_approval_posture,
    }),
    responseSchema: emptyResponseSchema,
    timeoutMs: 30_000,
    description:
      "Install a toolkit into the workspace or update its governance toggles.",
  }),

  initiateConnection: defineAuthenticatedEndpoint<
    {
      readonly toolkit_slug: string
      readonly owner_scope?: string
      readonly account_alias?: string
      readonly return_to_path?: string
      readonly initiate_surface?: string
      readonly callback_url: string
      readonly thread_id?: string
      readonly turn_id?: string
    },
    InitiateConnectionResponse
  >({
    id: "nabu.integrations-initiate-connection",
    service: SERVICES.NABU,
    audience: "nabu",
    method: "POST",
    path: "/api/v1/integrations/connections/initiate",
    body: (input) => input,
    responseSchema: initiateConnectionResponseSchema,
    timeoutMs: 30_000,
    description:
      "Start an OAuth connection: provisions the upstream auth config and returns the hosted connect link.",
  }),

  completeConnectionCallback: defineAuthenticatedEndpoint<
    {
      readonly session_id: string
      readonly state_nonce: string
    },
    { readonly status: string; readonly return_to_path: string }
  >({
    id: "nabu.integrations-connection-callback",
    service: SERVICES.NABU,
    audience: "nabu",
    method: "POST",
    path: "/api/v1/integrations/connections/callback",
    body: (input) => input,
    responseSchema: connectionCallbackResponseSchema,
    timeoutMs: 30_000,
    description:
      "Verify an OAuth callback's nonce, confirm the upstream account is active, and activate the connection.",
  }),

  reconnectConnection: defineAuthenticatedEndpoint<
    { readonly account_id: string; readonly callback_url: string },
    InitiateConnectionResponse
  >({
    id: "nabu.integrations-reconnect-connection",
    service: SERVICES.NABU,
    audience: "nabu",
    method: "POST",
    path: (input) =>
      `/api/v1/integrations/connections/${input.account_id}/reconnect`,
    body: (input) => ({ callback_url: input.callback_url }),
    responseSchema: initiateConnectionResponseSchema,
    timeoutMs: 30_000,
    description: "Start a fresh connect link for a broken connection.",
  }),

  patchConnection: defineAuthenticatedEndpoint<
    {
      readonly account_id: string
      readonly account_alias?: string
      readonly is_default?: boolean
      readonly status?: string
    },
    unknown
  >({
    id: "nabu.integrations-patch-connection",
    service: SERVICES.NABU,
    audience: "nabu",
    method: "PATCH",
    path: (input) => `/api/v1/integrations/connections/${input.account_id}`,
    body: (input) => ({
      account_alias: input.account_alias,
      is_default: input.is_default,
      status: input.status,
    }),
    responseSchema: emptyResponseSchema,
    timeoutMs: 15_000,
    description: "Rename, re-default, or pause a connected account.",
  }),

  deleteConnection: defineAuthenticatedEndpoint<
    { readonly account_id: string },
    unknown
  >({
    id: "nabu.integrations-delete-connection",
    service: SERVICES.NABU,
    audience: "nabu",
    method: "DELETE",
    path: (input) => `/api/v1/integrations/connections/${input.account_id}`,
    responseSchema: emptyResponseSchema,
    timeoutMs: 30_000,
    description:
      "Revoke a connected account upstream and mark it revoked locally.",
  }),

  putToolPolicy: defineAuthenticatedEndpoint<
    {
      readonly tool_slug: string
      readonly approval_mode: string
      readonly max_auto_calls_per_turn?: number
    },
    unknown
  >({
    id: "nabu.integrations-put-tool-policy",
    service: SERVICES.NABU,
    audience: "nabu",
    method: "PUT",
    path: (input) => `/api/v1/integrations/policies/${input.tool_slug}`,
    body: (input) => ({
      approval_mode: input.approval_mode,
      max_auto_calls_per_turn: input.max_auto_calls_per_turn,
    }),
    responseSchema: emptyResponseSchema,
    timeoutMs: 15_000,
    description: "Upsert the workspace's approval rule for one action.",
  }),

  createIntegrationRequest: defineAuthenticatedEndpoint<
    {
      readonly requested_app_name: string
      readonly requested_app_url?: string
      readonly use_case_description: string
      readonly priority?: string
    },
    unknown
  >({
    id: "nabu.integrations-create-request",
    service: SERVICES.NABU,
    audience: "nabu",
    method: "POST",
    path: "/api/v1/integrations/requests",
    body: (input) => input,
    responseSchema: emptyResponseSchema,
    timeoutMs: 15_000,
    description: "Submit a request for a new app integration.",
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
