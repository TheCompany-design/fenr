import { queryOptions } from "@tanstack/react-query"

import { getNabuCapabilitiesFn, getNabuSystemStatusFn } from "./nabu.functions"

export const nabuKeys = {
  all: ["nabu"] as const,
  systemStatus: () => [...nabuKeys.all, "system-status"] as const,
  capabilities: () => [...nabuKeys.all, "capabilities"] as const,
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
