import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { ensureSession } from "@/lib/auth/session"
import { withWideEvent } from "@/lib/logger"
import { getThreadChoice, getThreadMessages } from "./server/chat.server"

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

const getThreadChoiceInputSchema = z.object({
  threadId: z.string().uuid(),
})

export const getThreadChoiceFn = createServerFn({ method: "GET" })
  .validator((input: unknown) => getThreadChoiceInputSchema.parse(input))
  .handler(async ({ data }) => {
    return withWideEvent("chat", "getThreadChoice", async (setContext) => {
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

      return getThreadChoice(data.threadId, tenantId)
    })
  })
