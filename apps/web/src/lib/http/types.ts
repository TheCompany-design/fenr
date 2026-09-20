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
  readonly method: HttpMethod
  readonly auth: TAuth
  readonly responseSchema: ResponseSchema<TOutput>
  readonly inputSchema?: InputSchema<TInput>
  readonly timeoutMs?: number
  readonly description?: string
}

/**
 * Explicit caller headers type that prohibits specifying Authorization.
 * The shared transport owns the Authorization header and will reject or strip
 * any caller-supplied authorization header to prevent spoofing or accidental leakage.
 */
export type SafeCallerHeaders = Record<
  string,
  string | string[] | undefined
> & {
  authorization?: never
  Authorization?: never
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
  return {
    ...definition,
    auth: {
      type: "authenticated",
      service: definition.service,
      audience: definition.audience,
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
