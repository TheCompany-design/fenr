/**
 * Server-side session helpers.
 *
 * - `getSession`: null-safe session lookup for guards and UI context.
 * - `ensureSession`: throws when unauthenticated — use INSIDE server
 *   functions that must be authorized; a route guard alone is never
 *   sufficient (review-framework invariant #7).
 */
import { createMiddleware, createServerFn } from "@tanstack/react-start"
import { getRequestHeaders } from "@tanstack/react-start/server"

import type { Session } from "./auth"

import { auth } from "./auth"
import { moduleLogger } from "./logger"

const sessionLogger = moduleLogger("session")

export const getSession = createServerFn({ method: "GET" }).handler(
  async (): Promise<Session | null> => {
    try {
      return await auth.api.getSession({ headers: getRequestHeaders() })
    } catch (error) {
      // A broken auth backend should degrade to "no session" for guards, but
      // stay loud in logs so it is diagnosable.
      sessionLogger.error(
        {
          err:
            error instanceof Error
              ? { message: error.message, stack: error.stack }
              : String(error),
        },
        "session lookup failed",
      )
      return null
    }
  },
)

export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized")
    this.name = "UnauthorizedError"
  }
}

export const ensureSession = createServerFn({ method: "GET" }).handler(
  async (): Promise<Session> => {
    const session = await getSession()
    if (!session) {
      throw new UnauthorizedError()
    }
    return session
  },
)

export const authMiddleware = createMiddleware().server(async ({ next }) => {
  const session = await getSession()
  if (!session) {
    throw new UnauthorizedError()
  }
  return next({
    context: { session, user: session.user },
  })
})
