/**
 * Nabu HTTP calls for a workspace's own model provider.
 *
 * SERVER-ONLY. Thin over `executeRequest`: the interesting decisions — which
 * process dials the tenant's endpoint, and who may change it — are made in the
 * runtime, not here.
 *
 * The one thing this module does that the other Nabu adapters do not is resolve
 * the caller's authority and pass it along. Authority is a question about
 * membership, which this feature's caller already knows from the route context,
 * and the transport is deliberately free of database access.
 */

import { serverEnv } from "@/lib/env"
import {
  HttpClientError,
  type HttpClientErrorCode,
  nabuEndpoints,
} from "@/lib/http"
import { executeRequest } from "@/lib/http/client.server"
import type { ExecuteRequestOptions } from "@/lib/http/types"
import { moduleLogger } from "@/lib/logger"

const log = moduleLogger("nabu-provider")

import type {
  PutTenantProviderInput,
  TenantProvider,
  VerifyTenantProviderResponse,
} from "@/lib/schemas/nabu"

import { NabuClientError, runNabuRequest } from "./nabu.server"

export type { PutTenantProviderInput, TenantProvider }

/** Options every call here accepts, with the caller's workspace role attached. */
export interface TenantProviderRequestOptions extends ExecuteRequestOptions {
  readonly tenantRole: "owner" | "admin" | "member"
}

/**
 * Reads the workspace's model endpoint, model, and credential fingerprint.
 *
 * Never returns a key — the runtime's response shape has no field for one, and
 * the Zod schema here would reject it if it grew one.
 */
export async function getTenantProvider(
  options: TenantProviderRequestOptions,
): Promise<TenantProvider> {
  return runNabuRequest(() =>
    executeRequest(nabuEndpoints.tenantProvider, options),
  )
}

/**
 * Configures the workspace's model provider.
 *
 * The key is sent and then forgotten: the response is the redacted read shape, so
 * a caller cannot round-trip the credential into a cache or a log.
 */
export async function putTenantProvider(
  input: PutTenantProviderInput,
  options: TenantProviderRequestOptions,
): Promise<TenantProvider> {
  // Narrow and credential-free on purpose. The endpoint and model are what an
  // operator needs to see in a log to explain a failure; the key is never in this
  // object, and the fingerprint does not exist yet.
  const { api_key: _key, ...visible } = input
  log.info(
    {
      ...visible,
      tenantRole: options.tenantRole,
      target: serverEnv.NABU_SERVER_URL,
    },
    "sending a provider configuration to the runtime",
  )

  try {
    const saved = await runNabuRequest(() =>
      executeRequest(nabuEndpoints.putTenantProvider, { ...options, input }),
    )
    log.info(
      { configured: saved.configured, model: saved.model },
      "the runtime accepted the provider configuration",
    )
    return saved
  } catch (error) {
    log.error(
      {
        err: error instanceof Error ? error.message : String(error),
        tenantRole: options.tenantRole,
        target: serverEnv.NABU_SERVER_URL,
      },
      "the runtime did not accept the provider configuration",
    )
    throw error
  }
}

/**
 * Removes the workspace's model provider.
 *
 * Idempotent: the runtime answers `204` whether or not there was anything to
 * remove, so a retried save that races a delete is not reported as a failure.
 */
export async function deleteTenantProvider(
  options: TenantProviderRequestOptions,
): Promise<void> {
  // No catch. A `403` is a real answer about authority and has to reach the
  // caller unchanged — swallowing it would let a member's screen claim to have
  // removed a configuration it never touched.
  await runNabuRequest(() =>
    executeRequest(nabuEndpoints.deleteTenantProvider, options),
  )
}

/**
 * Asks the runtime to call the workspace's endpoint with its stored credential.
 *
 * `ok: false` means the endpoint answered and refused. An unreachable or
 * blocked endpoint arrives as an error status instead, so a caller that only
 * reads `ok` cannot mistake "your key is wrong" for "we could not try".
 */
export async function verifyTenantProvider(
  options: TenantProviderRequestOptions,
): Promise<VerifyTenantProviderResponse> {
  return runNabuRequest(() =>
    executeRequest(nabuEndpoints.verifyTenantProvider, {
      ...options,
      timeoutMs: options.timeoutMs ?? 20_000,
    }),
  )
}

/**
 * Whether an error is the runtime refusing the caller's authority.
 *
 * A helper rather than an inline comparison because "was this a 403" is asked in
 * three places in the settings form and each one should not be re-deriving the
 * answer from the transport's error shape.
 */
export function isPermissionDenied(error: unknown): boolean {
  return (
    error instanceof HttpClientError &&
    (error.status === 403 ||
      error.code ===
        ("CLIENT_CONFIGURATION_ERROR" satisfies HttpClientErrorCode))
  )
}

/**
 * Whether the runtime refused the *configuration* rather than the request.
 *
 * `422` covers two cases the runtime answers differently in prose but the same
 * way on the wire, and a form should treat them the same: nothing is configured
 * yet, or the endpoint resolves somewhere the runtime will not dial. Both mean
 * "this field needs changing", and both are distinct from a provider that
 * answered and refused its key, which comes back as `ok: false` instead.
 *
 * Named for what it groups rather than for one of the two cases, so that adding
 * a third `422` later does not quietly mislabel itself.
 */
export function isConfigurationRefused(error: unknown): boolean {
  return error instanceof HttpClientError && error.status === 422
}

export { NabuClientError }
