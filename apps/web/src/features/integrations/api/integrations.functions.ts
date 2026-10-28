import { createServerFn } from "@tanstack/react-start"
import { and, db, eq, schema } from "@workspace/database"
import { z } from "zod"

import { ensureSession } from "@/lib/auth/session"
import { serverEnv } from "@/lib/env"
import { nabuEndpoints } from "@/lib/http"
import { executeRequest } from "@/lib/http/client.server"
import { moduleLogger, withWideEvent } from "@/lib/logger"
import {
  connectionCallbackInputSchema,
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

export const getIntegrationsCatalogFn = createServerFn({
  method: "GET",
}).handler(async () => {
  return withWideEvent(
    "integrations",
    "getCatalog",
    async (setContext, requestId) => {
      const session = await requireSession()
      setContext({
        userId: session.user.id,
        organizationId: session.session.activeOrganizationId,
      })
      return executeRequest(nabuEndpoints.integrationsCatalog, { requestId })
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
 * Reads the composio tool slug behind an approval request item, so the chat
 * surface can offer "always allow" for exactly that action. `null` when the
 * item is not a composio approval.
 */
export const getApprovalToolFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ itemId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
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

        const payload = rows[0]?.payload as
          | { kind?: string; tool?: string }
          | undefined
        if (payload?.kind !== "approval_request") {
          return null
        }
        const tool = typeof payload.tool === "string" ? payload.tool : null
        if (!tool?.startsWith("composio-")) {
          return null
        }
        return { toolSlug: tool.slice("composio-".length).toUpperCase() }
      },
    )
  })
