import { createMiddleware, createServerFn } from "@tanstack/react-start"
import { getRequestHeaders } from "@tanstack/react-start/server"
import { moduleLogger } from "@/lib/logger"
import { auth, type Session } from "./index"

const sessionLogger = moduleLogger("session")

export const getSession = createServerFn({ method: "GET" }).handler(
  async (): Promise<Session | null> => {
    try {
      return await auth.api.getSession({ headers: getRequestHeaders() })
    } catch (error) {
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
