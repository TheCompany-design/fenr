/**
 * Better Auth HTTP handler mounted at /api/auth/*.
 *
 * All auth traffic (sign-in, sign-up, sign-out, get-session, error paths)
 * flows through the single Better Auth handler. Cookies are attached via
 * the tanstackStartCookies plugin (see src/lib/auth.ts).
 */
import { createFileRoute } from "@tanstack/react-router"

import { auth } from "@/lib/auth"
import { moduleLogger } from "@/lib/logger"

const apiLogger = moduleLogger("api.auth")

async function handleAuthRequest(request: Request): Promise<Response> {
  try {
    return await auth.handler(request)
  } catch (error) {
    apiLogger.error(
      {
        method: request.method,
        path: new URL(request.url).pathname,
        err:
          error instanceof Error
            ? { message: error.message, stack: error.stack }
            : String(error),
      },
      "auth handler failed",
    )
    return Response.json({ message: "Internal Server Error" }, { status: 500 })
  }
}

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }: { request: Request }) => handleAuthRequest(request),
      POST: ({ request }: { request: Request }) => handleAuthRequest(request),
    },
  },
})
