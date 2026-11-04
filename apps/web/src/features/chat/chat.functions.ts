import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { ensureSession } from "@/lib/auth/session"
import { withWideEvent } from "@/lib/logger"
import { getThreadUsage } from "../nabu/nabu.server"
import {
  deleteChatThread,
  getChatThreads,
  getThreadChoice,
  getThreadMessages,
  getThreadPendingApproval,
} from "./server/chat.server"

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

const getThreadPendingApprovalInputSchema = z.object({
  threadId: z.string().uuid(),
})

export const getThreadPendingApprovalFn = createServerFn({ method: "GET" })
  .validator((input: unknown) =>
    getThreadPendingApprovalInputSchema.parse(input),
  )
  .handler(async ({ data }) => {
    return withWideEvent(
      "chat",
      "getThreadPendingApproval",
      async (setContext) => {
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

        return getThreadPendingApproval(data.threadId, tenantId)
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

const getThreadUsageInputSchema = z.object({
  threadId: z.string().uuid(),
})

export const getThreadUsageFn = createServerFn({ method: "GET" })
  .validator((input: unknown) => getThreadUsageInputSchema.parse(input))
  .handler(async ({ data }) => {
    return withWideEvent("chat", "getThreadUsage", async (setContext) => {
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

      return getThreadUsage({ threadId: data.threadId })
    })
  })

const getChatThreadsInputSchema = z
  .object({
    limit: z.number().int().min(1).max(100).optional(),
  })
  .optional()

export const getChatThreadsFn = createServerFn({ method: "GET" })
  .validator((input: unknown) => getChatThreadsInputSchema.parse(input))
  .handler(async ({ data }) => {
    return withWideEvent("chat", "getChatThreads", async (setContext) => {
      const session = await ensureSession()
      const tenantId = session.session.activeOrganizationId

      if (!tenantId) {
        throw new Error("Active organization context is required")
      }

      setContext({
        userId: session.user.id,
        organizationId: tenantId,
      })

      return getChatThreads(tenantId, data?.limit)
    })
  })

const deleteChatThreadInputSchema = z.object({
  threadId: z.string().uuid(),
})

export const deleteChatThreadFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => deleteChatThreadInputSchema.parse(input))
  .handler(async ({ data }) => {
    return withWideEvent("chat", "deleteChatThread", async (setContext) => {
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

      return deleteChatThread(data.threadId, tenantId)
    })
  })
