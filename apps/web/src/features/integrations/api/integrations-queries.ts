import { queryOptions } from "@tanstack/react-query"

import {
  getIntegrationsCatalogFn,
  getToolkitDetailFn,
} from "./integrations.functions"

export const integrationsKeys = {
  all: ["integrations"] as const,
  catalog: () => [...integrationsKeys.all, "catalog"] as const,
  toolkit: (toolkitSlug: string) =>
    [...integrationsKeys.all, "toolkit", toolkitSlug] as const,
}

export const integrationsCatalogQueryOptions = () =>
  queryOptions({
    queryKey: integrationsKeys.catalog(),
    queryFn: () => getIntegrationsCatalogFn(),
    staleTime: 1000 * 30,
    retry: 1,
  })

export const integrationToolkitDetailQueryOptions = (
  toolkitSlug: string,
) =>
  queryOptions({
    queryKey: integrationsKeys.toolkit(toolkitSlug),
    queryFn: () => getToolkitDetailFn({ data: { toolkitSlug } }),
    staleTime: 1000 * 30,
    retry: 1,
  })

/** Derives each toolkit's aggregate connection state for the directory. */
export type ToolkitConnectionState =
  | "connected"
  | "needs_action"
  | "available"

export function toolkitConnectionState(
  toolkit: { connections: { status: string }[] },
): ToolkitConnectionState {
  if (toolkit.connections.length === 0) {
    return "available"
  }
  const needsAction = toolkit.connections.some((connection) =>
    ["expired", "needs_reauth", "error"].includes(connection.status),
  )
  return needsAction ? "needs_action" : "connected"
}
