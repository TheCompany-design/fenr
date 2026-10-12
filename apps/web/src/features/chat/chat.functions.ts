/**
 * Server functions for conversational chat operations.
 *
 * Exposes type-safe createServerFn endpoints for client consumption.
 * Validated with Zod and wrapped in wide-event logging with session verification.
 */

import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { ensureSession } from "@/lib/auth/session"
import { withWideEvent } from "@/lib/logger"
import { getThreadMessages, getThreadProvider } from "./server/chat.server"

const getThreadMessagesInputSchema = z.object({
  threadId: z.string().uuid(),
})

export const getThreadMessagesFn = createServerFn({ method: "GET" })
  .validator((input: unknown) => getThreadMessagesInputSchema.parse(input))
  .handler(async ({ data }) => {
    return withWideEvent(
      "chat",
      "getThreadMessages",
      async (setContext, requestId) => {
        const session = await ensureSession()
        const tenantId = session.session.activeOrganizationId

        if (!tenantId) {
          throw new Error("Active organization context is required")
        }

        setContext({
          userId: session.user.id,
          organizationId: tenantId,
          threadId: data.threadId,
        })

        return getThreadMessages(data.threadId, tenantId, { requestId })
      },
    )
  })

const getThreadProviderInputSchema = z.object({
  threadId: z.string().uuid(),
})

/**
 * Which saved provider this conversation runs on.
 *
 * The picker in the chat header reads this so the checkmark shows what the
 * conversation is *actually* set to — including on another device, or after a
 * suspension — rather than what this tab last clicked.
 */
export const getThreadProviderFn = createServerFn({ method: "GET" })
  .validator((input: unknown) => getThreadProviderInputSchema.parse(input))
  .handler(async ({ data }) => {
    return withWideEvent("chat", "getThreadProvider", async (setContext) => {
      const session = await ensureSession()
      const tenantId = session.session.activeOrganizationId

      if (!tenantId) {
        throw new Error("Active organization context is required")
      }

      setContext({
        userId: session.user.id,
        organizationId: tenantId,
        threadId: data.threadId,
      })

      return getThreadProvider(data.threadId, tenantId)
    })
  })
