import { queryOptions } from "@tanstack/react-query"

import { getNabuSystemStatusFn } from "./nabu.functions"

export const nabuSystemStatusQueryOptions = () =>
  queryOptions({
    queryKey: ["nabu", "system-status"] as const,
    queryFn: () => getNabuSystemStatusFn(),
    staleTime: 1000 * 30,
    retry: 1,
  })
