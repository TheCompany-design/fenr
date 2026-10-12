/**
 * Nabu HTTP calls for a workspace's saved model providers.
 *
 * SERVER-ONLY. Thin over `executeRequest`: the interesting decisions — which
 * process dials the vendor's endpoint, and who may change these — are made in
 * the runtime, not here.
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
  CreateTenantProviderInput,
  TenantProviderList,
  TenantProviderSummary,
  VerifyTenantProviderResponse,
} from "@/lib/schemas/nabu"

import { NabuClientError, runNabuRequest } from "./nabu.server"

export type { CreateTenantProviderInput, TenantProviderSummary }

/** Options every call here accepts, with the caller's workspace role attached. */
export interface TenantProviderRequestOptions extends ExecuteRequestOptions {
  readonly tenantRole: "owner" | "admin" | "member"
}

/**
 * Reads the workspace's saved providers — the list the settings screen renders
 * and the chat picker offers.
 *
 * Never returns a key — the runtime's response shape has no field for one, and
 * the Zod schema here would reject it if it grew one.
 */
export async function getTenantProviders(
  options: TenantProviderRequestOptions,
): Promise<TenantProviderList> {
  return runNabuRequest(() =>
    executeRequest(nabuEndpoints.tenantProviders, options),
  )
}

/**
 * Saves another provider configuration for the workspace.
 *
 * The key is sent and then forgotten: the response is the saved entry's
 * fingerprint shape, so a caller cannot round-trip the credential into a cache
 * or a log.
 */
export async function createTenantProvider(
  input: CreateTenantProviderInput,
  options: TenantProviderRequestOptions,
): Promise<TenantProviderSummary> {
  // Narrow and credential-free on purpose. The provider and model are what an
  // operator needs to see in a log to explain a failure; the key is never in
  // this object, and the fingerprint does not exist yet.
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
      executeRequest(nabuEndpoints.createTenantProvider, { ...options, input }),
    )
    log.info(
      {
        provider: saved.provider,
        model: saved.model,
        is_default: saved.is_default,
      },
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
 * Removes one of the workspace's saved providers.
 *
 * Idempotent: the runtime answers `204` whether or not there was anything to
 * remove, so a retried delete that races another is not reported as a failure.
 * Conversations that referenced it fall back to the workspace's default.
 */
export async function deleteTenantProvider(
  input: { readonly id: string },
  options: TenantProviderRequestOptions,
): Promise<void> {
  // No catch. A `403` is a real answer about authority and has to reach the
  // caller unchanged — swallowing it would let a member's screen claim to have
  // removed a configuration it never touched.
  await runNabuRequest(() =>
    executeRequest(nabuEndpoints.deleteTenantProvider, { ...options, input }),
  )
}

/**
 * Marks one saved provider as the one new conversations start on.
 */
export async function setDefaultTenantProvider(
  input: { readonly id: string },
  options: TenantProviderRequestOptions,
): Promise<void> {
  await runNabuRequest(() =>
    executeRequest(nabuEndpoints.setDefaultTenantProvider, {
      ...options,
      input,
    }),
  )
}

/**
 * Asks the runtime to call one saved provider with its stored credential.
 *
 * `ok: false` means the provider answered and refused. An unreachable provider
 * arrives as an error status instead, so a caller that only reads `ok` cannot
 * mistake "your key is wrong" for "we could not try".
 */
export async function verifyTenantProvider(
  input: { readonly id: string },
  options: TenantProviderRequestOptions,
): Promise<VerifyTenantProviderResponse> {
  return runNabuRequest(() =>
    executeRequest(nabuEndpoints.verifyTenantProvider, {
      ...options,
      input,
      timeoutMs: options.timeoutMs ?? 20_000,
    }),
  )
}

/**
 * Whether an error is the runtime refusing the caller's authority.
 *
 * A helper rather than an inline comparison because "was this a 403" is asked
 * in the settings form and each one should not be re-deriving the answer from
 * the transport's error shape.
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
 * `422` means the provider cannot be reached from the runtime — a
 * deployment-level refusal to dial, not a wrong key. A wrong key comes back as
 * `ok: false` instead, and a list that is full comes back as a `400` naming
 * the cap, so the two are never confused by a client that only checks the
 * status.
 *
 * Named for what it groups rather than for one case, so that adding a second
 * `422` later does not quietly mislabel itself.
 */
export function isConfigurationRefused(error: unknown): boolean {
  return error instanceof HttpClientError && error.status === 422
}

export { NabuClientError }
