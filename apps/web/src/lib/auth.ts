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
import { tanstackStartCookies } from "better-auth/tanstack-start"

import { serverEnv } from "./env"
import { moduleLogger } from "./logger"

const authLogger = moduleLogger("auth")

export const auth = betterAuth({
  baseURL: serverEnv.BETTER_AUTH_URL,
  secret: serverEnv.BETTER_AUTH_SECRET,

  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),

  // Let the adapter fetch user+session in a single SQL join.
  advanced: {
    database: {
      joins: true,
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
          authLogger.info({ userId: user.id }, "user registered")
        },
      },
    },
    session: {
      create: {
        async after(session) {
          authLogger.info(
            { userId: session.userId, sessionId: session.id },
            "session created",
          )
        },
      },
      delete: {
        async after(session) {
          authLogger.info(
            { userId: session.userId, sessionId: session.id },
            "session deleted",
          )
        },
      },
    },
  },

  plugins: [
    // Must be the last plugin — handles cookie setting for TanStack Start.
    tanstackStartCookies(),
  ],
})

export type Session = typeof auth.$Infer.Session
