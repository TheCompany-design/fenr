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
  ProviderModelsResponse,
  TenantProviderList,
  TenantProviderSummary,
  VerifyTenantProviderResponse,
} from "@/lib/schemas/nabu"

import { NabuClientError, runNabuRequest } from "./nabu.server"

export type { CreateTenantProviderInput, TenantProviderSummary }

export interface TenantProviderRequestOptions extends ExecuteRequestOptions {
  readonly tenantRole: "owner" | "admin" | "member"
}

export async function getTenantProviders(
  options: TenantProviderRequestOptions,
): Promise<TenantProviderList> {
  return runNabuRequest(() =>
    executeRequest(nabuEndpoints.tenantProviders, options),
  )
}

export async function createTenantProvider(
  input: CreateTenantProviderInput,
  options: TenantProviderRequestOptions,
): Promise<TenantProviderSummary> {
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

export async function deleteTenantProvider(
  input: { readonly id: string },
  options: TenantProviderRequestOptions,
): Promise<void> {
  await runNabuRequest(() =>
    executeRequest(nabuEndpoints.deleteTenantProvider, { ...options, input }),
  )
}

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

export async function listProviderModels(
  input: { readonly provider: string; readonly api_key: string },
  options: TenantProviderRequestOptions,
): Promise<ProviderModelsResponse> {
  return runNabuRequest(() =>
    executeRequest(nabuEndpoints.listProviderModels, {
      ...options,
      input,
      timeoutMs: options.timeoutMs ?? 20_000,
    }),
  )
}

export async function savedProviderModels(
  input: { readonly id: string },
  options: TenantProviderRequestOptions,
): Promise<ProviderModelsResponse> {
  return runNabuRequest(() =>
    executeRequest(nabuEndpoints.savedProviderModels, {
      ...options,
      input,
      timeoutMs: options.timeoutMs ?? 20_000,
    }),
  )
}

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

export function isPermissionDenied(error: unknown): boolean {
  return (
    error instanceof HttpClientError &&
    (error.status === 403 ||
      error.code ===
        ("CLIENT_CONFIGURATION_ERROR" satisfies HttpClientErrorCode))
  )
}

export function isConfigurationRefused(error: unknown): boolean {
  return error instanceof HttpClientError && error.status === 422
}

export { NabuClientError }
