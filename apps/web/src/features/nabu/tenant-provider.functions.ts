import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

import { getActiveOrganizationRole } from "@/features/organizations/operations/organization-role.server"
import { ensureSession } from "@/lib/auth/session"
import { moduleLogger, withWideEvent } from "@/lib/logger"
import { createTenantProviderInputSchema } from "@/lib/schemas/nabu"
import type { OrganizationRole } from "@/lib/schemas/organizations"

import {
  createTenantProvider,
  deleteTenantProvider,
  getTenantProviders,
  listProviderModels,
  savedProviderModels,
  setDefaultTenantProvider,
  verifyTenantProvider,
} from "./tenant-provider.server"

async function activeRole(): Promise<OrganizationRole> {
  const session = await ensureSession()
  const organizationId = session.session.activeOrganizationId

  const role = await getActiveOrganizationRole(session.user.id, organizationId)

  if (!role) {
    moduleLogger("nabu-provider").error(
      {
        organizationId: organizationId ?? null,
        userId: session.user.id,
      },
      "the caller has an active workspace but no resolvable role",
    )
    throw new Error(
      organizationId
        ? "Your role in this workspace could not be determined"
        : "No active workspace is selected",
    )
  }

  return role
}

export const getTenantProvidersFn = createServerFn({ method: "GET" }).handler(
  async () => {
    return withWideEvent(
      "nabu",
      "getTenantProviders",
      async (setContext, requestId) => {
        const session = await ensureSession()
        const tenantRole = await activeRole()
        setContext({
          userId: session.user.id,
          organizationId: session.session.activeOrganizationId,
          tenantRole,
        })
        return getTenantProviders({ requestId, tenantRole })
      },
    )
  },
)

export const createTenantProviderFn = createServerFn({ method: "POST" })

  .validator((input: unknown) => createTenantProviderInputSchema.parse(input))
  .handler(async ({ data }) => {
    return withWideEvent(
      "nabu",
      "createTenantProvider",
      async (setContext, requestId) => {
        const session = await ensureSession()
        const tenantRole = await activeRole()
        setContext({
          userId: session.user.id,
          organizationId: session.session.activeOrganizationId,
          tenantRole,
        })

        return createTenantProvider(data, { requestId, tenantRole })
      },
    )
  })

const providerIdInputSchema = (input: unknown) => {
  if (typeof input !== "object" || input === null || !("id" in input)) {
    throw new Error("a saved provider id is required")
  }
  const id = (input as { id: unknown }).id
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("a saved provider id is required")
  }
  return { id }
}

export const deleteTenantProviderFn = createServerFn({ method: "POST" })
  .validator(providerIdInputSchema)
  .handler(async ({ data }) => {
    return withWideEvent(
      "nabu",
      "deleteTenantProvider",
      async (setContext, requestId) => {
        const session = await ensureSession()
        const tenantRole = await activeRole()
        setContext({
          userId: session.user.id,
          organizationId: session.session.activeOrganizationId,
          tenantRole,
        })
        return deleteTenantProvider(data, { requestId, tenantRole })
      },
    )
  })

export const setDefaultTenantProviderFn = createServerFn({ method: "POST" })
  .validator(providerIdInputSchema)
  .handler(async ({ data }) => {
    return withWideEvent(
      "nabu",
      "setDefaultTenantProvider",
      async (setContext, requestId) => {
        const session = await ensureSession()
        const tenantRole = await activeRole()
        setContext({
          userId: session.user.id,
          organizationId: session.session.activeOrganizationId,
          tenantRole,
        })
        return setDefaultTenantProvider(data, { requestId, tenantRole })
      },
    )
  })

export const listProviderModelsFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        provider: z.string().trim().min(1),
        api_key: z.string().trim().min(1).max(4096),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    return withWideEvent(
      "nabu",
      "listProviderModels",
      async (setContext, requestId) => {
        const session = await ensureSession()
        const tenantRole = await activeRole()
        setContext({
          userId: session.user.id,
          organizationId: session.session.activeOrganizationId,
          tenantRole,
        })
        return listProviderModels(data, { requestId, tenantRole })
      },
    )
  })

export const savedProviderModelsFn = createServerFn({ method: "POST" })
  .validator(providerIdInputSchema)
  .handler(async ({ data }) => {
    return withWideEvent(
      "nabu",
      "savedProviderModels",
      async (setContext, requestId) => {
        const session = await ensureSession()
        const tenantRole = await activeRole()
        setContext({
          userId: session.user.id,
          organizationId: session.session.activeOrganizationId,
          tenantRole,
        })
        return savedProviderModels(data, { requestId, tenantRole })
      },
    )
  })

export const verifyTenantProviderFn = createServerFn({ method: "POST" })
  .validator(providerIdInputSchema)
  .handler(async ({ data }) => {
    return withWideEvent(
      "nabu",
      "verifyTenantProvider",
      async (setContext, requestId) => {
        const session = await ensureSession()
        const tenantRole = await activeRole()
        setContext({
          userId: session.user.id,
          organizationId: session.session.activeOrganizationId,
          tenantRole,
        })
        return verifyTenantProvider(data, {
          requestId,
          tenantRole,
          timeoutMs: 20_000,
        })
      },
    )
  })
