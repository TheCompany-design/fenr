/**
 * Server functions for a workspace's saved model providers.
 *
 * Each one resolves the caller's authority from the active session and attaches
 * it to the outbound token, because the runtime — not this service — decides who
 * may change a workspace's model credentials. The role is read here and nowhere
 * else in the write path, so there is one place to audit.
 */

import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
// A `.server.ts` module, imported by path rather than through the feature
// barrel. The resolver reads membership, the membership module pulls in the
// database driver, and that driver runs `Buffer.allocUnsafe` at import time —
// which throws in a browser. Reaching it through the barrel made it a live client
// export, so the bundler kept it, `pg` reached the browser, and every route in
// the app stopped hydrating.
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

/**
 * The caller's authority in their active workspace.
 *
 * Read from membership, not from the session. The session carries an active
 * *organization* but no role — an earlier version of this read a
 * `session.session.activeOrganizationRole` through a cast, which compiled, and
 * then failed at runtime for every caller because the field does not exist. The
 * cast is what hid it: it told the compiler to trust a shape nobody had checked.
 *
 * Throws rather than defaulting, for the same reason the resolver returns `null`
 * rather than `member`: "we cannot name your authority" must not become "you have
 * the least of it", or an owner is stranded unable to save their own settings.
 */
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
  // Written as a parse function, not as a bare schema, because that is the form
  // every other server function in this app uses. Passing the schema object
  // directly typechecks — `ConstrainValidator` accepts anything with a
  // `~standard` shape, which Zod v4 has — and then behaves differently at
  // runtime, which is the worst combination available: it survives `tsc` and
  // `bun run check` and fails only when somebody presses the button.
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
        // `data` is never logged: it carries the credential. The wide event
        // records who changed what, not what they changed it to.
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

/**
 * Reads a vendor's model catalogue with a credential that is not saved yet —
 * the create form's pick list.
 *
 * Owner/admin only, like every endpoint that dials with a credential: the
 * runtime opens the socket through its egress guard, and this function only
 * carries the session's authority out to it.
 */
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

/**
 * Reads one saved configuration's model catalogue — the edit path of the same
 * pick list, dialled with the stored credential.
 */
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
