/**
 * Server functions for a workspace's own model provider.
 *
 * Each one resolves the caller's authority from the active session and attaches
 * it to the outbound token, because the runtime — not this service — decides who
 * may change a workspace's model credential. The role is read here and nowhere
 * else in the write path, so there is one place to audit.
 */

import { createServerFn } from "@tanstack/react-start"

import { ensureSession } from "@/lib/auth/session"
import { withWideEvent } from "@/lib/logger"
import { putTenantProviderInputSchema } from "@/lib/schemas/nabu"

import {
  deleteTenantProvider,
  getTenantProvider,
  putTenantProvider,
  verifyTenantProvider,
} from "./tenant-provider.server"

/**
 * The caller's authority in their active workspace.
 *
 * Throws rather than defaulting. A missing active organization is a genuine
 * "we do not know who you are acting for", and answering it with `member` would
 * turn a broken session context into a confusing refusal several layers away.
 */
async function activeRole(): Promise<"owner" | "admin" | "member"> {
  const session = await ensureSession()
  const organizationId = session.session.activeOrganizationId
  if (!organizationId) {
    throw new Error("Active organization required")
  }

  // The session does not carry a role, so it is read from the membership the
  // organization plugin already resolved. `session.session` is the trusted,
  // server-derived shape here — never a client-supplied field.
  const role = (session.session as { activeOrganizationRole?: unknown })
    .activeOrganizationRole

  if (role === "owner" || role === "admin" || role === "member") {
    return role
  }

  // Unknown role: refuse rather than guess. `member` would silently under-report
  // an owner's authority and strand them unable to save their own settings.
  throw new Error("Workspace role could not be determined")
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
  .inputValidator(putTenantProviderInputSchema)
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
