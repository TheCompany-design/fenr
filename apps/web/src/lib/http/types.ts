import type { z } from "zod"

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

export type EndpointAuth =
  | {
      readonly type: "authenticated"
      readonly service: string
      readonly audience: string
    }
  | {
      readonly type: "public"
    }

export type ResponseSchema<T> = z.ZodType<T>
export type InputSchema<T> = z.ZodType<T>

export interface TurnItemsInput {
  readonly turnId: string
  readonly after?: string
  readonly limit?: number
}

export interface EndpointDefinition<
  TInput = void,
  TOutput = unknown,
  TAuth extends EndpointAuth = EndpointAuth,
> {
  readonly id: string
  readonly service: string
  readonly path: string | ((input: TInput) => string)

  readonly body?: (input: TInput) => unknown
  readonly method: HttpMethod
  readonly auth: TAuth
  readonly responseSchema: ResponseSchema<TOutput>
  readonly inputSchema?: InputSchema<TInput>
  readonly timeoutMs?: number
  readonly description?: string
}

export type SafeCallerHeaders = Record<
  string,
  string | string[] | undefined
> & {
  authorization?: never
  Authorization?: never
  AUTHORIZATION?: never
}

export interface ExecuteRequestOptions<TInput = void> {
  readonly input?: TInput

  readonly headers?: SafeCallerHeaders
  readonly timeoutMs?: number
  readonly signal?: AbortSignal
  readonly requestId?: string

  readonly headersSource?: Headers

  readonly token?: string

  readonly tokenProvider?: (
    auth: Extract<EndpointAuth, { type: "authenticated" }>,
  ) => Promise<string>

  readonly tenantRole?: "owner" | "admin" | "member"
}

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
