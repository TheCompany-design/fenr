import type { BetterAuthOptions } from "better-auth"
import { moduleLogger } from "@/lib/logger"
import {
  resolveUserActiveOrganization,
  setActiveOrganizationPreference,
} from "@/lib/organizations"

const authLogger = moduleLogger("auth")

type SessionHooks = NonNullable<
  NonNullable<BetterAuthOptions["databaseHooks"]>["session"]
>

export const sessionHooks: SessionHooks = {
  create: {
    async before(session) {
      if (!session) return { data: session }
      const sess = session as typeof session & {
        activeOrganizationId?: string | null
      }
      if (!sess.activeOrganizationId && sess.userId) {
        try {
          const resolved = await resolveUserActiveOrganization(sess.userId)
          if (resolved.organizationId) {
            return {
              data: {
                ...session,
                activeOrganizationId: resolved.organizationId,
              },
            }
          }
        } catch (error) {
          authLogger.warn(
            { err: error, userId: sess.userId },
            "failed to auto-resolve active organization during session creation",
          )
        }
      }
      return { data: session }
    },
    async after(session) {
      if (!session) return
      const sess = session as typeof session & {
        activeOrganizationId?: string | null
      }
      if (
        sess.activeOrganizationId &&
        typeof sess.activeOrganizationId === "string" &&
        sess.userId
      ) {
        try {
          await setActiveOrganizationPreference(
            sess.userId,
            sess.activeOrganizationId,
            sess.updatedAt,
          )
        } catch (error) {
          authLogger.warn(
            {
              err: error,
              userId: sess.userId,
              orgId: sess.activeOrganizationId,
            },
            "failed to sync active organization preference on session creation",
          )
        }
      }

      authLogger.info(
        {
          userId: sess.userId,
          sessionId: sess.id,
          activeOrganizationId: sess.activeOrganizationId,
        },
        "session created",
      )
    },
  },
  update: {
    async after(session) {
      if (!session) return
      const sess = session as typeof session & {
        activeOrganizationId?: string | null
      }
      if (
        sess.activeOrganizationId &&
        typeof sess.activeOrganizationId === "string" &&
        sess.userId
      ) {
        try {
          await setActiveOrganizationPreference(
            sess.userId,
            sess.activeOrganizationId,
            sess.updatedAt,
          )
        } catch (error) {
          authLogger.warn(
            {
              err: error,
              userId: sess.userId,
              orgId: sess.activeOrganizationId,
            },
            "failed to sync active organization preference on session update",
          )
        }
      }
    },
  },
  delete: {
    async after(session) {
      if (!session) return
      authLogger.info(
        { userId: session.userId, sessionId: session.id },
        "session deleted",
      )
    },
  },
}
