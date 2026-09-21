/**
 * Outbound JWT token provider.
 *
 * SERVER-ONLY: Mints short-lived JWT tokens for downstream private services
 * using Better Auth's server instance and the active session context.
 *
 * All tokens carry tenant context (`activeOrganizationId`) and strictly
 * enforce the target endpoint's declared audience.
 */

import { getRequestHeaders } from "@tanstack/react-start/server"
import { auth } from "@/lib/auth"
import { moduleLogger } from "@/lib/logger"
import { HttpClientError } from "./errors"
import type { EndpointAuth } from "./types"

const log = moduleLogger("http:token")

export interface TokenAcquisitionOptions {
  readonly headersSource?: Headers
  readonly token?: string
  readonly tokenProvider?: (
    auth: Extract<EndpointAuth, { type: "authenticated" }>,
  ) => Promise<string>
  readonly signal?: AbortSignal
}

/**
 * Acquires a signed JWT token for an authenticated outbound request.
 */
export async function acquireOutboundJwt(
  authContract: Extract<EndpointAuth, { type: "authenticated" }>,
  options: TokenAcquisitionOptions = {},
): Promise<string> {
  // 0. Check cancellation before initiating async work
  if (options.signal?.aborted) {
    throw new HttpClientError("Request was cancelled", {
      code: "CANCELLED",
      status: 499,
      service: authContract.service,
      cause: options.signal.reason,
    })
  }

  // 1. If an explicit token is passed, use it directly (e.g. test overrides)
  if (options.token) {
    return options.token
  }

  // 2. If a custom token provider is supplied, delegate to it
  if (options.tokenProvider) {
    try {
      return await options.tokenProvider(authContract)
    } catch (err) {
      log.error(
        { err, service: authContract.service },
        "custom token provider failed",
      )
      throw new HttpClientError(
        `Failed to acquire authorization token for ${authContract.service}`,
        {
          code: "UNAUTHENTICATED",
          status: 401,
          service: authContract.service,
          cause: err,
        },
      )
    }
  }

  // 3. Resolve incoming request headers from options or TanStack Start server context
  let headers: Headers | undefined = options.headersSource
  if (!headers) {
    try {
      headers = getRequestHeaders()
    } catch {
      // Outside active request context (e.g. CLI runner, background worker, or unit tests)
    }
  }

  if (headers) {
    let session: Awaited<ReturnType<typeof auth.api.getSession>>
    try {
      session = await auth.api.getSession({ headers })
    } catch (err) {
      log.error(
        {
          err: err instanceof Error ? err.message : String(err),
          service: authContract.service,
        },
        "failed to fetch session from authentication service",
      )
      throw new HttpClientError(
        `Failed to verify session for ${authContract.service} due to authentication service error`,
        {
          code: "SERVICE_UNREACHABLE",
          status: 502,
          service: authContract.service,
          cause: err,
        },
      )
    }

    if (session?.user?.id) {
      if (!session.session?.activeOrganizationId) {
        log.warn(
          {
            userId: session.user.id,
            service: authContract.service,
          },
          "outbound token acquisition rejected: missing active organization context",
        )
        throw new HttpClientError(
          `Tenant context required: active organization context is missing for ${authContract.service}`,
          {
            code: "UNAUTHENTICATED",
            status: 401,
            service: authContract.service,
          },
        )
      }

      let signRes: { token?: string } | null = null
      try {
        signRes = await auth.api.signJWT({
          body: {
            payload: {
              sub: session.user.id,
              email: session.user.email,
              activeOrganizationId: session.session.activeOrganizationId,
            },
            overrideOptions: {
              jwt: {
                audience: authContract.audience,
              },
            },
          },
        })
      } catch (err) {
        log.error(
          {
            err: err instanceof Error ? err.message : String(err),
            service: authContract.service,
          },
          "failed to sign outbound JWT",
        )
        throw new HttpClientError(
          `Failed to mint authorization token for ${authContract.service} due to signing service error`,
          {
            code: "SERVICE_UNREACHABLE",
            status: 502,
            service: authContract.service,
            cause: err,
          },
        )
      }

      if (signRes?.token) {
        return signRes.token
      }

      throw new HttpClientError(
        `Failed to mint authorization token for ${authContract.service}: empty token returned`,
        {
          code: "SERVICE_UNREACHABLE",
          status: 502,
          service: authContract.service,
        },
      )
    }
  }

  // 4. If no session is found, reject the request safely
  throw new HttpClientError(
    `Unauthenticated: active session is required to communicate with private ${authContract.service} service`,
    {
      code: "UNAUTHENTICATED",
      status: 401,
      service: authContract.service,
    },
  )
}
