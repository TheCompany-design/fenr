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

  // 1. Resolve incoming request headers from options or TanStack Start server context
  let headers: Headers | undefined = options.headersSource
  if (!headers) {
    try {
      headers = getRequestHeaders()
    } catch {
      // Outside active request context (e.g. CLI runner, background worker, or unit tests)
    }
  }

  let session: Awaited<ReturnType<typeof auth.api.getSession>> | null = null
  try {
    session = await auth.api.getSession({ headers: headers ?? new Headers() })
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

  // 2. Enforce active session
  if (!session?.user?.id) {
    throw new HttpClientError(
      `Unauthenticated: active session is required to communicate with private ${authContract.service} service`,
      {
        code: "UNAUTHENTICATED",
        status: 401,
        service: authContract.service,
      },
    )
  }

  // 3. Enforce tenant context (activeOrganizationId)
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

  const activeOrgId = session.session.activeOrganizationId

  // 4. Handle caller-supplied token or tokenProvider overrides
  if (options.token || options.tokenProvider) {
    let candidateToken: string
    if (options.token) {
      candidateToken = options.token
    } else if (options.tokenProvider) {
      try {
        candidateToken = await options.tokenProvider(authContract)
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
    } else {
      throw new HttpClientError(
        `Failed to acquire authorization token for ${authContract.service}: missing token provider`,
        {
          code: "UNAUTHENTICATED",
          status: 401,
          service: authContract.service,
        },
      )
    }

    // Verify candidate token against JWKS to enforce signature, audience, and tenant context
    let verified: Awaited<ReturnType<typeof auth.api.verifyJWT>> | null = null
    try {
      verified = await auth.api.verifyJWT({
        body: { token: candidateToken },
      })
    } catch (err) {
      log.warn(
        {
          err: err instanceof Error ? err.message : String(err),
          service: authContract.service,
        },
        "failed to verify caller-supplied token override",
      )
      throw new HttpClientError(
        `Failed to verify token override for ${authContract.service}: invalid token signature or format`,
        {
          code: "UNAUTHENTICATED",
          status: 401,
          service: authContract.service,
          cause: err,
        },
      )
    }

    if (!verified?.payload) {
      throw new HttpClientError(
        `Token override rejected for ${authContract.service}: invalid or unverified token`,
        {
          code: "UNAUTHENTICATED",
          status: 401,
          service: authContract.service,
        },
      )
    }

    const payload = verified.payload as {
      aud?: string | string[]
      activeOrganizationId?: string
    }

    const aud = payload.aud
    const matchesAudience = Array.isArray(aud)
      ? aud.includes(authContract.audience)
      : aud === authContract.audience

    if (!matchesAudience) {
      log.warn(
        {
          expectedAudience: authContract.audience,
          tokenAudience: aud,
          service: authContract.service,
        },
        "token override audience mismatch",
      )
      throw new HttpClientError(
        `Token override rejected: audience does not match target ${authContract.service} service`,
        {
          code: "UNAUTHENTICATED",
          status: 401,
          service: authContract.service,
        },
      )
    }

    if (
      !payload.activeOrganizationId ||
      payload.activeOrganizationId !== activeOrgId
    ) {
      log.warn(
        {
          expectedTenant: activeOrgId,
          tokenTenant: payload.activeOrganizationId,
          service: authContract.service,
        },
        "token override tenant context mismatch",
      )
      throw new HttpClientError(
        `Token override rejected: tenant context does not match active organization for ${authContract.service}`,
        {
          code: "UNAUTHENTICATED",
          status: 401,
          service: authContract.service,
        },
      )
    }

    return candidateToken
  }

  // 5. Mint a fresh short-lived JWT token from active session context
  let signRes: { token?: string } | null = null
  try {
    signRes = await auth.api.signJWT({
      body: {
        payload: {
          sub: session.user.id,
          email: session.user.email,
          activeOrganizationId: activeOrgId,
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
