import { createServerFn } from "@tanstack/react-start"
import { and, db, eq, schema } from "@workspace/database"
import { z } from "zod"

import { ensureSession } from "@/lib/auth/session"
import { serverEnv } from "@/lib/env"
import { HttpClientError, nabuEndpoints } from "@/lib/http"
import { executeRequest } from "@/lib/http/client.server"
import { moduleLogger, withWideEvent } from "@/lib/logger"
import {
  connectionCallbackInputSchema,
  type IntegrationsCatalogResult,
  initiateConnectionInputSchema,
  patchConnectionInputSchema,
  putToolPolicyInputSchema,
  reconnectConnectionInputSchema,
  requestIntegrationInputSchema,
  toolkitSlugSchema,
  updateToolkitConfigInputSchema,
} from "@/lib/schemas/integrations"

const log = moduleLogger("integrations")

/** The BFF origin Composio sends the browser back to after OAuth. */
function oauthCallbackUrl(): string {
  return `${serverEnv.BETTER_AUTH_URL.replace(/\/$/, "")}/integrations/oauth/callback`
}

async function requireSession() {
  const session = await ensureSession()
  if (!session.session.activeOrganizationId) {
    throw new Error("No active workspace is selected")
  }
  return session
}

async function requireAdmin() {
  const session = await requireSession()
  const role = session.session.activeOrganizationId
    ? await roleOf(session.user.id)
    : null
  if (role !== "owner" && role !== "admin") {
    throw new Error("Only workspace owners and admins may manage integrations")
  }
  return session
}

async function roleOf(userId: string): Promise<string | null> {
  const { getActiveOrganizationRole } = await import(
    "@/features/organizations/operations/organization-role.server"
  )
  return getActiveOrganizationRole(userId)
}

function humanizeToolName(raw: string): string {
  const withoutPrefix = raw.startsWith("composio-")
    ? raw.slice("composio-".length)
    : raw
  return withoutPrefix
    .split(/[_-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ")
}

export type ApprovalToolJsonValue =
  | string
  | number
  | boolean
  | null
  | ApprovalToolJsonValue[]
  | { [key: string]: ApprovalToolJsonValue }

export interface ApprovalToolMetadata {
  readonly tool: string
  readonly callId: string | null
  readonly toolSlug: string | null
  readonly toolkitSlug: string | null
  readonly displayName: string
  readonly description: string | null
  readonly capabilityClass: string | null
  readonly arguments: Record<string, ApprovalToolJsonValue>
}

export const getIntegrationsCatalogFn = createServerFn({
  method: "GET",
}).handler(async (): Promise<IntegrationsCatalogResult> => {
  return withWideEvent(
    "integrations",
    "getCatalog",
    async (setContext, requestId): Promise<IntegrationsCatalogResult> => {
      const session = await requireSession()
      setContext({
        userId: session.user.id,
        organizationId: session.session.activeOrganizationId,
      })

      try {
        return await executeRequest(nabuEndpoints.integrationsCatalog, {
          requestId,
        })
      } catch (error) {
        // A deployment without the gateway (501) or an unreachable runtime
        // is a state the page renders, not a fault it crashes on.
        if (error instanceof HttpClientError) {
          const reason =
            error.status === 501
              ? ("not_configured" as const)
              : error.code === "SERVICE_UNREACHABLE"
                ? ("unreachable" as const)
                : null
          if (reason) {
            log.warn(
              { status: error.status, code: error.code },
              "the integrations catalog is unavailable; rendering the degraded state",
            )
            return { unavailable: true, reason }
          }
        }
        throw error
      }
    },
  )
})

export const getToolkitDetailFn = createServerFn({ method: "GET" })
  .validator((input: unknown) =>
    z.object({ toolkitSlug: toolkitSlugSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    return withWideEvent(
      "integrations",
      "getToolkitDetail",
      async (setContext, requestId) => {
        const session = await requireSession()
        setContext({
          userId: session.user.id,
          organizationId: session.session.activeOrganizationId,
          toolkitSlug: data.toolkitSlug,
        })
        return executeRequest(nabuEndpoints.integrationsToolkitDetail, {
          requestId,
          input: { toolkitSlug: data.toolkitSlug },
        })
      },
    )
  })

export const updateToolkitConfigFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => updateToolkitConfigInputSchema.parse(input))
  .handler(async ({ data }) => {
    return withWideEvent(
      "integrations",
      "updateToolkitConfig",
      async (setContext, requestId) => {
        const session = await requireAdmin()
        setContext({
          userId: session.user.id,
          organizationId: session.session.activeOrganizationId,
          toolkitSlug: data.toolkitSlug,
        })
        await executeRequest(nabuEndpoints.updateToolkitConfig, {
          requestId,
          input: {
            toolkitSlug: data.toolkitSlug,
            enabled_for_agents: data.enabledForAgents,
            connection_sharing_mode: data.connectionSharingMode,
            workspace_approval_posture: data.workspaceApprovalPosture,
          },
        })
      },
    )
  })

export const initiateConnectionFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => initiateConnectionInputSchema.parse(input))
  .handler(async ({ data }) => {
    return withWideEvent(
      "integrations",
      "initiateConnection",
      async (setContext, requestId) => {
        const session = await requireSession()
        setContext({
          userId: session.user.id,
          organizationId: session.session.activeOrganizationId,
          toolkitSlug: data.toolkitSlug,
          surface: data.initiateSurface ?? "integrations_page",
        })
        const response = await executeRequest(
          nabuEndpoints.initiateConnection,
          {
            requestId,
            input: {
              toolkit_slug: data.toolkitSlug,
              owner_scope: data.ownerScope,
              account_alias: data.accountAlias,
              return_to_path: data.returnToPath,
              initiate_surface: data.initiateSurface,
              callback_url: oauthCallbackUrl(),
              thread_id: data.threadId,
              turn_id: data.turnId,
            },
          },
        )
        log.info(
          { toolkitSlug: data.toolkitSlug, sessionId: response.session_id },
          "an OAuth connection was initiated",
        )
        return response
      },
    )
  })

export const completeConnectionCallbackFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => connectionCallbackInputSchema.parse(input))
  .handler(async ({ data }) => {
    return withWideEvent(
      "integrations",
      "completeConnectionCallback",
      async (setContext, requestId) => {
        const session = await requireSession()
        setContext({
          userId: session.user.id,
          organizationId: session.session.activeOrganizationId,
        })
        return executeRequest(nabuEndpoints.completeConnectionCallback, {
          requestId,
          input: {
            session_id: data.sessionId,
            state_nonce: data.stateNonce,
          },
        })
      },
    )
  })

export const reconnectConnectionFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => reconnectConnectionInputSchema.parse(input))
  .handler(async ({ data }) => {
    return withWideEvent(
      "integrations",
      "reconnectConnection",
      async (setContext, requestId) => {
        const session = await requireSession()
        setContext({
          userId: session.user.id,
          organizationId: session.session.activeOrganizationId,
          accountId: data.accountId,
        })
        return executeRequest(nabuEndpoints.reconnectConnection, {
          requestId,
          input: {
            account_id: data.accountId,
            callback_url: oauthCallbackUrl(),
          },
        })
      },
    )
  })

export const patchConnectionFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => patchConnectionInputSchema.parse(input))
  .handler(async ({ data }) => {
    return withWideEvent(
      "integrations",
      "patchConnection",
      async (setContext, requestId) => {
        const session = await requireSession()
        setContext({
          userId: session.user.id,
          organizationId: session.session.activeOrganizationId,
          accountId: data.accountId,
        })
        await executeRequest(nabuEndpoints.patchConnection, {
          requestId,
          input: {
            account_id: data.accountId,
            account_alias: data.accountAlias,
            is_default: data.isDefault,
            status: data.status,
          },
        })
      },
    )
  })

export const deleteConnectionFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ accountId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    return withWideEvent(
      "integrations",
      "deleteConnection",
      async (setContext, requestId) => {
        const session = await requireSession()
        setContext({
          userId: session.user.id,
          organizationId: session.session.activeOrganizationId,
          accountId: data.accountId,
        })
        await executeRequest(nabuEndpoints.deleteConnection, {
          requestId,
          input: { account_id: data.accountId },
        })
      },
    )
  })

export const putToolPolicyFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => putToolPolicyInputSchema.parse(input))
  .handler(async ({ data }) => {
    return withWideEvent(
      "integrations",
      "putToolPolicy",
      async (setContext, requestId) => {
        await requireAdmin()
        setContext({
          toolSlug: data.toolSlug,
          approvalMode: data.approvalMode,
        })
        await executeRequest(nabuEndpoints.putToolPolicy, {
          requestId,
          input: {
            tool_slug: data.toolSlug,
            approval_mode: data.approvalMode,
            max_auto_calls_per_turn: data.maxAutoCallsPerTurn,
          },
        })
      },
    )
  })

export const requestIntegrationFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => requestIntegrationInputSchema.parse(input))
  .handler(async ({ data }) => {
    return withWideEvent(
      "integrations",
      "requestIntegration",
      async (setContext, requestId) => {
        const session = await requireSession()
        setContext({
          userId: session.user.id,
          organizationId: session.session.activeOrganizationId,
        })
        await executeRequest(nabuEndpoints.createIntegrationRequest, {
          requestId,
          input: {
            requested_app_name: data.requestedAppName,
            requested_app_url: data.requestedAppUrl,
            use_case_description: data.useCaseDescription,
            priority: data.priority,
          },
        })
      },
    )
  })

/**
 * Reads the approval request details and optional Composio catalog metadata for
 * a suspended turn's `approval_request` item.
 */
export const getApprovalToolFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ itemId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }): Promise<ApprovalToolMetadata | null> => {
    return withWideEvent(
      "integrations",
      "getApprovalTool",
      async (setContext) => {
        const session = await requireSession()
        const organizationId = session.session.activeOrganizationId
        if (!organizationId) {
          throw new Error("No active workspace is selected")
        }
        setContext({
          userId: session.user.id,
          organizationId,
          itemId: data.itemId,
        })

        const rows = await db
          .select({ payload: schema.agentItems.payload })
          .from(schema.agentItems)
          .where(
            and(
              eq(schema.agentItems.id, data.itemId),
              eq(schema.agentItems.tenantId, organizationId),
            ),
          )
          .limit(1)

        const payload = rows[0]?.payload as
          | {
              kind?: string
              tool?: string
              call_id?: string
              arguments?: unknown
            }
          | undefined
        if (payload?.kind !== "approval_request") {
          return null
        }

        const tool =
          typeof payload.tool === "string" && payload.tool.trim()
            ? payload.tool
            : "unknown_tool"
        const callId =
          typeof payload.call_id === "string" ? payload.call_id : null
        const rawArguments =
          payload.arguments &&
          typeof payload.arguments === "object" &&
          !Array.isArray(payload.arguments)
            ? (payload.arguments as Record<string, ApprovalToolJsonValue>)
            : {}

        const toolSlug = tool.startsWith("composio-")
          ? tool.slice("composio-".length).toUpperCase()
          : null

        if (!toolSlug) {
          return {
            tool,
            callId,
            toolSlug: null,
            toolkitSlug: null,
            displayName: humanizeToolName(tool),
            description: null,
            capabilityClass: null,
            arguments: rawArguments,
          }
        }

        const [catalogTool] = await db
          .select({
            displayName: schema.integrationCatalogTools.displayName,
            description: schema.integrationCatalogTools.description,
            toolkitSlug: schema.integrationCatalogTools.toolkitSlug,
            capabilityClass: schema.integrationCatalogTools.capabilityClass,
          })
          .from(schema.integrationCatalogTools)
          .where(eq(schema.integrationCatalogTools.slug, toolSlug))
          .limit(1)

        return {
          tool,
          callId,
          toolSlug,
          toolkitSlug: catalogTool?.toolkitSlug ?? null,
          displayName: catalogTool?.displayName ?? humanizeToolName(tool),
          description: catalogTool?.description ?? null,
          capabilityClass: catalogTool?.capabilityClass ?? null,
          arguments: rawArguments,
        }
      },
    )
  })
