/**
 * Server functions for Nabu engine operations.
 *
 * Exposes type-safe createServerFn endpoints for client consumption.
 * Validated with Zod and wrapped in wide-event logging with session verification.
 * Delegates transport and business execution to server-only modules.
 */

import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { ensureSession } from "@/lib/auth/session"
import { withWideEvent } from "@/lib/logger"
import { approvalDecisionSchema } from "@/lib/schemas/agent-stream"

import {
  cancelTurn,
  decideApproval,
  getNabuCapabilities,
  getNabuSystemStatus,
  getTurnItems,
  OrganizationRequiredError,
  resumeTurn,
} from "./nabu.server"

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

const turnScopedSchema = z.object({ turnId: z.string().uuid() })

/**
 * What this deployment lets a turn do.
 *
 * Read before a conversation rather than during one: the interface should be
 * able to say what the agent may reach, not discover it as a tool failure.
 */
export const getNabuCapabilitiesFn = createServerFn({ method: "GET" }).handler(
  async () => {
    return withWideEvent(
      "nabu",
      "getCapabilities",
      async (setContext, requestId) => {
        const session = await ensureSession()
        if (!session.session.activeOrganizationId) {
          throw new OrganizationRequiredError()
        }
        setContext({
          userId: session.user.id,
          organizationId: session.session.activeOrganizationId,
        })
        return getNabuCapabilities({ requestId })
      },
    )
  },
)

/**
 * A turn's transcript.
 *
 * This is how a reconnecting or reloading reader rebuilds the timeline: the
 * runtime holds the durable record, so the client does not have to have kept
 * it.
 */
export const getTurnItemsFn = createServerFn({ method: "GET" })
  .validator((input: unknown) =>
    z
      .object({
        turnId: z.string().uuid(),
        after: z.string().uuid().optional(),
        limit: z.number().int().positive().max(200).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    return withWideEvent(
      "nabu",
      "getTurnItems",
      async (setContext, requestId) => {
        const session = await ensureSession()
        if (!session.session.activeOrganizationId) {
          throw new OrganizationRequiredError()
        }
        setContext({
          userId: session.user.id,
          organizationId: session.session.activeOrganizationId,
          turnId: data.turnId,
        })
        return getTurnItems(data, { requestId })
      },
    )
  })

/**
 * Answer a pending approval.
 *
 * This is the action that unblocks a suspended turn, so it is a mutation with a
 * real effect: the runtime refuses a second decision for the same request.
 */
export const decideApprovalFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        turnId: z.string().uuid(),
        itemId: z.string().uuid(),
        decision: approvalDecisionSchema,
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    return withWideEvent(
      "nabu",
      "decideApproval",
      async (setContext, requestId) => {
        const session = await ensureSession()
        if (!session.session.activeOrganizationId) {
          throw new OrganizationRequiredError()
        }
        setContext({
          userId: session.user.id,
          organizationId: session.session.activeOrganizationId,
          turnId: data.turnId,
        })
        await decideApproval(
          {
            turnId: data.turnId,
            itemId: data.itemId,
            decision: data.decision,
          },
          { requestId },
        )
        return { recorded: true as const }
      },
    )
  })

/** Stop a running or suspended turn. */
export const cancelTurnFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => turnScopedSchema.parse(input))
  .handler(async ({ data }) => {
    return withWideEvent(
      "nabu",
      "cancelTurn",
      async (setContext, requestId) => {
        const session = await ensureSession()
        if (!session.session.activeOrganizationId) {
          throw new OrganizationRequiredError()
        }
        setContext({
          userId: session.user.id,
          organizationId: session.session.activeOrganizationId,
          turnId: data.turnId,
        })
        await cancelTurn({ turnId: data.turnId }, { requestId })
        return { cancelled: true as const }
      },
    )
  })

/** Resume a suspended turn once a decision has been recorded. */
export const resumeTurnFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => turnScopedSchema.parse(input))
  .handler(async ({ data }) => {
    return withWideEvent(
      "nabu",
      "resumeTurn",
      async (setContext, requestId) => {
        const session = await ensureSession()
        if (!session.session.activeOrganizationId) {
          throw new OrganizationRequiredError()
        }
        setContext({
          userId: session.user.id,
          organizationId: session.session.activeOrganizationId,
          turnId: data.turnId,
        })
        await resumeTurn({ turnId: data.turnId }, { requestId })
        return { resumed: true as const }
      },
    )
  })
