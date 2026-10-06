import type { z } from "zod"

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

/**
 * Authentication contract for an endpoint.
 */
export type EndpointAuth =
  | {
      readonly type: "authenticated"
      readonly service: string
      readonly audience: string
    }
  | {
      readonly type: "public"
    }

/**
 * Supported schema contract (Zod schema).
 */
export type ResponseSchema<T> = z.ZodType<T>
export type InputSchema<T> = z.ZodType<T>

/**
 * A turn-scoped read: which turn, and where to page from.
 *
 * The turn is part of the path, so it belongs to the input rather than to the
 * endpoint definition.
 */
export interface TurnItemsInput {
  readonly turnId: string
  readonly after?: string
  readonly limit?: number
}

/**
 * An immutable definition of an outbound HTTP endpoint.
 */
export interface EndpointDefinition<
  TInput = void,
  TOutput = unknown,
  TAuth extends EndpointAuth = EndpointAuth,
> {
  readonly id: string
  readonly service: string
  readonly path: string | ((input: TInput) => string)
  /**
   * What to send as the request body.
   *
   * Defaults to the validated input. Override it when part of the input is
   * routing rather than payload — a turn id in the path has no business in the
   * body, and an endpoint that takes no payload should send none.
   */
  readonly body?: (input: TInput) => unknown
  readonly method: HttpMethod
  readonly auth: TAuth
  readonly responseSchema: ResponseSchema<TOutput>
  readonly inputSchema?: InputSchema<TInput>
  readonly timeoutMs?: number
  readonly description?: string
}

/**
 * Explicit caller headers type that prohibits specifying Authorization.
 * Note: HTTP header names are case-insensitive. While TypeScript provides type-level
 * hints for common casings, the shared transport unconditionally strips and normalizes
 * all authorization headers at runtime to prevent spoofing or accidental leakage.
 */
export type SafeCallerHeaders = Record<
  string,
  string | string[] | undefined
> & {
  authorization?: never
  Authorization?: never
  AUTHORIZATION?: never
}

/**
 * Execution options passed when calling an endpoint.
 */
export interface ExecuteRequestOptions<TInput = void> {
  readonly input?: TInput
  /**
   * Caller headers. Cannot contain Authorization or authorization.
   */
  readonly headers?: SafeCallerHeaders
  readonly timeoutMs?: number
  readonly signal?: AbortSignal
  readonly requestId?: string
  /**
   * Optional incoming request headers source (e.g. from getRequestHeaders())
   * used by the server transport to resolve session and mint JWTs.
   */
  readonly headersSource?: Headers
  /**
   * Optional manual token override for testing or specialized delegation.
   */
  readonly token?: string
  /**
   * Optional custom token provider for testing or specialized delegation.
   */
  readonly tokenProvider?: (
    auth: Extract<EndpointAuth, { type: "authenticated" }>,
  ) => Promise<string>
  /**
   * The caller's authority inside the active workspace, added to the outbound
   * token as a `role` claim.
   *
   * Why it is passed per request rather than resolved inside the transport: the
   * transport is deliberately free of database access, and authority is a
   * question about membership, which the feature that owns membership answers.
   *
   * Omitting it means the token carries no role, and the runtime treats that as
   * the *least* privilege. So a caller who forgets to pass one cannot
   * administer anything — the failure is a refused write, not an unauthorized
   * one.
   */
  readonly tenantRole?: "owner" | "admin" | "member"
}

/**
 * Define an endpoint that requires an authenticated JWT bearer token.
 */
export function defineAuthenticatedEndpoint<TInput = void, TOutput = unknown>(
  definition: Omit<
    EndpointDefinition<
      TInput,
      TOutput,
      {
        readonly type: "authenticated"
        readonly service: string
        readonly audience: string
      }
    >,
    "auth"
  > & {
    readonly audience: string
  },
): EndpointDefinition<
  TInput,
  TOutput,
  {
    readonly type: "authenticated"
    readonly service: string
    readonly audience: string
  }
> {
  const { audience, ...endpoint } = definition
  return {
    ...endpoint,
    auth: {
      type: "authenticated",
      service: definition.service,
      audience,
    },
  }
}

/**
 * Define an endpoint that is explicitly public (third-party demo API, webhook, etc.).
 * Public endpoints will NEVER send an Authorization header.
 */
export function definePublicEndpoint<TInput = void, TOutput = unknown>(
  definition: Omit<
    EndpointDefinition<TInput, TOutput, { readonly type: "public" }>,
    "auth"
  >,
): EndpointDefinition<TInput, TOutput, { readonly type: "public" }> {
  return {
    ...definition,
    auth: {
      type: "public",
    },
  }
}
