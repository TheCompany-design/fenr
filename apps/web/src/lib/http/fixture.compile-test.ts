import { z } from "zod"
import {
  defineAuthenticatedEndpoint,
  definePublicEndpoint,
  type EndpointDefinition,
  type SafeCallerHeaders,
} from "./types"

const testSchema = z.object({ ok: z.boolean() })

export const validAuthenticated = defineAuthenticatedEndpoint<
  void,
  { ok: boolean }
>({
  id: "valid.authenticated",
  service: "nabu",
  audience: "nabu",
  method: "GET",
  path: "/api/v1/test",
  responseSchema: testSchema,
})

export const validPublic = definePublicEndpoint<void, { ok: boolean }>({
  id: "valid.public",
  service: "demo",
  method: "GET",
  path: "https://example.com/api",
  responseSchema: testSchema,
})

export const missingAudience = defineAuthenticatedEndpoint<
  void,
  { ok: boolean }
>(
  // @ts-expect-error - Property 'audience' is missing in type
  {
    id: "missing.audience",
    service: "nabu",
    method: "GET",
    path: "/api/v1/test",
    responseSchema: testSchema,
  },
)

export const missingService = defineAuthenticatedEndpoint<
  void,
  { ok: boolean }
>(
  // @ts-expect-error - Property 'service' is missing in type
  {
    id: "missing.service",
    audience: "nabu",
    method: "GET",
    path: "/api/v1/test",
    responseSchema: testSchema,
  },
)

// @ts-expect-error - Property 'auth' is missing in type
export const missingAuth: EndpointDefinition<void, { ok: boolean }> = {
  id: "missing.auth",
  service: "nabu",
  method: "GET",
  path: "/api/v1/test",
  responseSchema: testSchema,
}

export const invalidAuthType: EndpointDefinition<void, { ok: boolean }> = {
  id: "invalid.auth",
  service: "nabu",
  method: "GET",
  path: "/api/v1/test",
  responseSchema: testSchema,
  // @ts-expect-error - Type '"none"' is not assignable to type 'EndpointAuth'
  auth: { type: "none" },
}

export const illegalHeaders: SafeCallerHeaders = {
  // @ts-expect-error - Type 'string' is not assignable to type 'undefined'
  Authorization: "Bearer spoofed-token",
}

export const illegalHeadersLowercase: SafeCallerHeaders = {
  // @ts-expect-error - Type 'string' is not assignable to type 'undefined'
  authorization: "Bearer spoofed-token",
}
