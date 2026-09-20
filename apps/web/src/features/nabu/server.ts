/**
 * Server functions for Nabu engine operations.
 *
 * Exposes type-safe createServerFn endpoints for client consumption.
 * Validated with Zod and wrapped in wide-event logging with session verification.
 */

import { createServerFn } from "@tanstack/react-start"

import { withWideEvent } from "@/lib/logger"
import {
  createAgentTaskInputSchema,
  reconciliationMatchInputSchema,
} from "@/lib/schemas/nabu"
import { ensureSession } from "@/lib/session"

import {
  dispatchAgentTask,
  getNabuSystemStatus,
  matchInflowReconciliation,
} from "./client"

export class OrganizationRequiredError extends Error {
  constructor(message = "Active organization required") {
    super(message)
    this.name = "OrganizationRequiredError"
  }
}

export const getNabuSystemStatusFn = createServerFn({ method: "GET" }).handler(
  async () => {
    return withWideEvent(
      "nabu",
      "getSystemStatus",
      async (setContext, requestId) => {
        const session = await ensureSession()
        setContext({
          userId: session.user.id,
          organizationId: session.session.activeOrganizationId,
        })
        return getNabuSystemStatus({ requestId })
      },
    )
  },
)

export const matchInflowReconciliationFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => reconciliationMatchInputSchema.parse(input))
  .handler(async ({ data }) => {
    return withWideEvent(
      "nabu",
      "matchInflowReconciliation",
      async (setContext, requestId) => {
        const session = await ensureSession()
        if (!session.session.activeOrganizationId) {
          throw new OrganizationRequiredError()
        }
        setContext({
          userId: session.user.id,
          organizationId: session.session.activeOrganizationId,
        })
        return matchInflowReconciliation(data, { requestId })
      },
    )
  })

export const dispatchAgentTaskFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => createAgentTaskInputSchema.parse(input))
  .handler(async ({ data }) => {
    return withWideEvent(
      "nabu",
      "dispatchAgentTask",
      async (setContext, requestId) => {
        const session = await ensureSession()
        if (!session.session.activeOrganizationId) {
          throw new OrganizationRequiredError()
        }
        setContext({
          userId: session.user.id,
          organizationId: session.session.activeOrganizationId,
        })
        return dispatchAgentTask(data, { requestId })
      },
    )
  })
