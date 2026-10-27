import { queryOptions } from "@tanstack/react-query"

import {
  getNabuCapabilitiesFn,
  getNabuSystemStatusFn,
  getUsageSummaryFn,
} from "./nabu.functions"
import { getTenantProvidersFn } from "./tenant-provider.functions"

export const nabuKeys = {
  all: ["nabu"] as const,
  systemStatus: () => [...nabuKeys.all, "system-status"] as const,
  capabilities: () => [...nabuKeys.all, "capabilities"] as const,
  usageSummary: (days?: number) =>
    [...nabuKeys.all, "usage-summary", days ?? 30] as const,
}

export const tenantProviderKeys = {
  all: ["tenant-provider"] as const,

  list: () => [...tenantProviderKeys.all, "list"] as const,
}

export const nabuSystemStatusQueryOptions = () =>
  queryOptions({
    queryKey: nabuKeys.systemStatus(),
    queryFn: () => getNabuSystemStatusFn(),
    staleTime: 1000 * 30,
    retry: 1,
  })

export const nabuCapabilitiesQueryOptions = () =>
  queryOptions({
    queryKey: nabuKeys.capabilities(),
    queryFn: () => getNabuCapabilitiesFn(),
    staleTime: 1000 * 60 * 5,
    retry: 1,
  })

export const tenantProvidersQueryOptions = () =>
  queryOptions({
    queryKey: tenantProviderKeys.list(),
    queryFn: () => getTenantProvidersFn(),
    staleTime: 1000 * 60 * 2,
    retry: 1,
  })

export const usageSummaryQueryOptions = (days: number = 30) =>
  queryOptions({
    queryKey: nabuKeys.usageSummary(days),
    queryFn: () => getUsageSummaryFn({ data: { days } }),
    staleTime: 1000 * 60,
    retry: 1,
  })
