/**
 * Server functions for a workspace's own model provider.
 *
 * Each one resolves the caller's authority from the active session and attaches
 * it to the outbound token, because the runtime — not this service — decides who
 * may change a workspace's model credential. The role is read here and nowhere
 * else in the write path, so there is one place to audit.
 */

import { createServerFn } from "@tanstack/react-start"

import { getActiveOrganizationRole } from "@/features/organizations"
import { ensureSession } from "@/lib/auth/session"
import { moduleLogger, withWideEvent } from "@/lib/logger"
import { putTenantProviderInputSchema } from "@/lib/schemas/nabu"
import type { OrganizationRole } from "@/lib/schemas/organizations"

import {
  deleteTenantProvider,
  getTenantProvider,
  putTenantProvider,
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

export const getTenantProviderFn = createServerFn({ method: "GET" }).handler(
  async () => {
    return withWideEvent(
      "nabu",
      "getTenantProvider",
      async (setContext, requestId) => {
        const session = await ensureSession()
        const tenantRole = await activeRole()
        setContext({
          userId: session.user.id,
          organizationId: session.session.activeOrganizationId,
          tenantRole,
        })
        return getTenantProvider({ requestId, tenantRole })
      },
    )
  },
)

export const putTenantProviderFn = createServerFn({ method: "POST" })
  // Written as a parse function, not as a bare schema, because that is the form
  // every other server function in this app uses. Passing the schema object
  // directly typechecks — `ConstrainValidator` accepts anything with a
  // `~standard` shape, which Zod v4 has — and then behaves differently at
  // runtime, which is the worst combination available: it survives `tsc` and
  // `bun run check` and fails only when somebody presses the button.
  .validator((input: unknown) => putTenantProviderInputSchema.parse(input))
  .handler(async ({ data }) => {
    return withWideEvent(
      "nabu",
      "putTenantProvider",
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
        return putTenantProvider(data, { requestId, tenantRole })
      },
    )
  })

export const deleteTenantProviderFn = createServerFn({
  method: "POST",
}).handler(async () => {
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
      return deleteTenantProvider({ requestId, tenantRole })
    },
  )
})

export const verifyTenantProviderFn = createServerFn({
  method: "POST",
}).handler(async () => {
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
      return verifyTenantProvider({ requestId, tenantRole })
    },
  )
})
