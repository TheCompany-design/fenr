import { QueryClient } from "@tanstack/react-query"

/**
 * Factory for per-request (server) / per-session (client) QueryClients.
 *
 * Fenr convention: ALL network fetches outside of app runtime go through
 * TanStack Query. Never use bare fetch() in components/effects.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  })
}
