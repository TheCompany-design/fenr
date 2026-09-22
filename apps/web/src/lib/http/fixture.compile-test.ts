/**
 * Compile-time typecheck fixture for Outbound HTTP architecture.
 *
 * Verifies that:
 * 1. Missing or invalid auth policy is rejected at compile time.
 * 2. Authenticated endpoints require audience and service.
 * 3. Caller headers cannot specify Authorization (type-level protection).
 * 4. Fully specified authenticated and public endpoints typecheck cleanly.
 */

import { z } from "zod"
import {
  defineAuthenticatedEndpoint,
  definePublicEndpoint,
  type EndpointDefinition,
  type SafeCallerHeaders,
} from "./types"

const testSchema = z.object({ ok: z.boolean() })

// 1. Valid authenticated endpoint: Compiles cleanly
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

// 2. Valid public endpoint: Compiles cleanly
export const validPublic = definePublicEndpoint<void, { ok: boolean }>({
  id: "valid.public",
  service: "demo",
  method: "GET",
  path: "https://example.com/api",
  responseSchema: testSchema,
})

// 3. Negative check: missing audience in defineAuthenticatedEndpoint
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

// 4. Negative check: missing service in defineAuthenticatedEndpoint
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

// 5. Negative check: missing auth policy in raw EndpointDefinition
// @ts-expect-error - Property 'auth' is missing in type
export const missingAuth: EndpointDefinition<void, { ok: boolean }> = {
  id: "missing.auth",
  service: "nabu",
  method: "GET",
  path: "/api/v1/test",
  responseSchema: testSchema,
}

// 6. Negative check: invalid auth type
export const invalidAuthType: EndpointDefinition<void, { ok: boolean }> = {
  id: "invalid.auth",
  service: "nabu",
  method: "GET",
  path: "/api/v1/test",
  responseSchema: testSchema,
  // @ts-expect-error - Type '"none"' is not assignable to type 'EndpointAuth'
  auth: { type: "none" },
}

// 7. Negative check: SafeCallerHeaders prohibits Authorization
export const illegalHeaders: SafeCallerHeaders = {
  // @ts-expect-error - Type 'string' is not assignable to type 'undefined'
  Authorization: "Bearer spoofed-token",
}

// 8. Negative check: SafeCallerHeaders prohibits lowercase authorization
export const illegalHeadersLowercase: SafeCallerHeaders = {
  // @ts-expect-error - Type 'string' is not assignable to type 'undefined'
  authorization: "Bearer spoofed-token",
}
