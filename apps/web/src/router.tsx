import { createRouter } from "@tanstack/react-router"
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query"
import { createQueryClient } from "./lib/query"
import { routeTree } from "./routeTree.gen"

export function getRouter() {
  const queryClient = createQueryClient()

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
  })

  // TanStack Start <-> TanStack Query SSR integration: handles dehydration,
  // hydration and query streaming without manual HydrationBoundary wrappers.
  setupRouterSsrQueryIntegration({ router, queryClient })

  return router
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
