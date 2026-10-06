import { queryOptions } from "@tanstack/react-query"

import { getNabuCapabilitiesFn, getNabuSystemStatusFn } from "./nabu.functions"
import { getTenantProviderFn } from "./tenant-provider.functions"

export const nabuKeys = {
  all: ["nabu"] as const,
  systemStatus: () => [...nabuKeys.all, "system-status"] as const,
  capabilities: () => [...nabuKeys.all, "capabilities"] as const,
}

/**
 * Keys for the workspace's own model provider.
 *
 * Separate from `nabuKeys` because this one is invalidated by a settings write,
 * and lumping it in with the deployment's static capabilities would mean saving a
 * provider also refetching the engine's version.
 */
export const tenantProviderKeys = {
  all: ["tenant-provider"] as const,
  detail: () => [...tenantProviderKeys.all, "detail"] as const,
}

/**
 * Whether the runtime is reachable.
 *
 * Retried once: a dashboard that renders "unavailable" because the engine was
 * restarting is worse than one that waits a moment.
 */
export const nabuSystemStatusQueryOptions = () =>
  queryOptions({
    queryKey: nabuKeys.systemStatus(),
    queryFn: () => getNabuSystemStatusFn(),
    staleTime: 1000 * 30,
    retry: 1,
  })

/**
 * What a turn may do here: its tools, its attempt budget, and whether a
 * disconnected client ends the turn or only loses the stream.
 *
 * Kept for longer than the status because it describes the deployment rather
 * than its current health.
 */
export const nabuCapabilitiesQueryOptions = () =>
  queryOptions({
    queryKey: nabuKeys.capabilities(),
    queryFn: () => getNabuCapabilitiesFn(),
    staleTime: 1000 * 60 * 5,
    retry: 1,
  })

/**
 * The workspace's model provider.
 *
 * Cached because the chat header reads it on every conversation view, and it
 * changes only when someone edits settings. A read that is slightly stale for a
 * minute is a better trade than one Nabu call per render.
 */
export const tenantProviderQueryOptions = () =>
  queryOptions({
    queryKey: tenantProviderKeys.detail(),
    queryFn: () => getTenantProviderFn(),
    staleTime: 1000 * 60 * 2,
    retry: 1,
  })
