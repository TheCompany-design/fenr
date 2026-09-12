/**
 * Better Auth server instance.
 *
 * SERVER-ONLY: never import from client code — this pulls in the database
 * and the auth secret. Client code uses `auth-client.ts` instead.
 *
 * Plugin ordering matters: `tanstackStartCookies()` must stay LAST so it can
 * attach Set-Cookie headers to the TanStack Start response (review-framework
 * invariant #7).
 */

import { db, schema } from "@workspace/database"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { magicLink, organization } from "better-auth/plugins"
import { tanstackStartCookies } from "better-auth/tanstack-start"

import { serverEnv } from "./env"
import { moduleLogger } from "./logger"
import { sendMagicLinkEmail, sendOrganizationInvitationEmail } from "./mail"
import {
  resolveUserActiveOrganization,
  setActiveOrganizationPreference,
} from "./organizations"

const authLogger = moduleLogger("auth")

export const auth = betterAuth({
  baseURL: serverEnv.BETTER_AUTH_URL,
  secret: serverEnv.BETTER_AUTH_SECRET,

  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),

  // Let the adapter fetch user+session in a single SQL join, and delegate
  // ID generation to native Postgres 18 uuidv7().
  advanced: {
    database: {
      joins: true,
      generateId: false,
    },
  },

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },

  databaseHooks: {
    user: {
      create: {
        async after(user) {
          if (!user) return
          authLogger.info({ userId: user.id }, "user registered")
        },
      },
    },
    session: {
      create: {
        async before(session) {
          if (!session) return { data: session }
          if (!session.activeOrganizationId) {
            try {
              const resolved = await resolveUserActiveOrganization(
                session.userId,
              )
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
                { err: error, userId: session.userId },
                "failed to auto-resolve active organization during session creation",
              )
            }
          }
          return { data: session }
        },
        async after(session) {
          if (!session) return
          // If session was created with activeOrganizationId, ensure preference is recorded
          if (
            session.activeOrganizationId &&
            typeof session.activeOrganizationId === "string"
          ) {
            try {
              await setActiveOrganizationPreference(
                session.userId,
                session.activeOrganizationId,
                session.updatedAt,
              )
            } catch (error) {
              authLogger.warn(
                {
                  err: error,
                  userId: session.userId,
                  orgId: session.activeOrganizationId,
                },
                "failed to sync active organization preference on session creation",
              )
            }
          }

          authLogger.info(
            {
              userId: session.userId,
              sessionId: session.id,
              activeOrganizationId: session.activeOrganizationId,
            },
            "session created",
          )
        },
      },
      update: {
        async after(session) {
          if (!session) return
          // Synchronize only when activeOrganizationId is explicitly set to a string
          if (typeof session.activeOrganizationId === "string") {
            try {
              await setActiveOrganizationPreference(
                session.userId,
                session.activeOrganizationId,
                session.updatedAt,
              )
            } catch (error) {
              authLogger.warn(
                {
                  err: error,
                  userId: session.userId,
                  orgId: session.activeOrganizationId,
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
    },
  },

  plugins: [
    magicLink({
      sendMagicLink: async ({ email, token, url }) => {
        await sendMagicLinkEmail({
          to: email,
          token,
          url,
          expiresInMinutes: 10,
        })
      },
      expiresIn: 600, // 10 minutes
    }),

    organization({
      allowUserToCreateOrganization: true,
      creatorRole: "owner",
      invitationExpiresIn: 48 * 60 * 60, // 48 hours
      sendInvitationEmail: async (data) => {
        const baseUrl = serverEnv.BETTER_AUTH_URL.replace(/\/+$/, "")
        const acceptUrl = `${baseUrl}/invitations/accept?id=${encodeURIComponent(data.id)}`
        const inviterName = data.inviter?.user?.name || "A team member"

        await sendOrganizationInvitationEmail({
          to: data.email,
          organizationName: data.organization.name,
          inviterName,
          role: data.role,
          acceptUrl,
          expiresInHours: 48,
        })
      },
    }),

    // Must be the last plugin — handles cookie setting for TanStack Start.
    tanstackStartCookies(),
  ],
})

export type Session = typeof auth.$Infer.Session
