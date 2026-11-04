import { type AnyRouter, createRouter } from "@tanstack/react-router"
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query"
import { createQueryClient } from "./lib/query"
import { routeTree } from "./routeTree.gen"

/**
 * Polyfills `router.serverSsr.isDehydrated()` for compatibility between
 * `@tanstack/router-ssr-query-core` and `@tanstack/router-core` >= 1.171.39.
 *
 * Recent versions of `@tanstack/router-core` removed `isDehydrated()` from
 * the `serverSsr` interface in favor of internal `dehydrationPhase`. However,
 * `@tanstack/router-ssr-query-core`'s query cache subscriber still relies on
 * `router.serverSsr?.isDehydrated()` to determine whether a query completion
 * should be streamed vs included in the initial SSR dehydration payload.
 *
 * Without this shim, query cache events during SSR trigger:
 * `TypeError: router.serverSsr?.isDehydrated is not a function.`
 */
function patchRouterServerSsr(router: AnyRouter) {
  let isDehydrated = false
  let currentServerSsr = (
    router as unknown as { serverSsr?: Record<string, unknown> }
  ).serverSsr

  const attachDehydratedShim = (serverSsr: unknown) => {
    if (serverSsr && typeof serverSsr === "object") {
      const record = serverSsr as Record<string, unknown>
      if (typeof record.isDehydrated !== "function") {
        record.isDehydrated = () => isDehydrated
      }
    }
  }

  attachDehydratedShim(currentServerSsr)

  router.serverSsrLifecycle = {
    ...router.serverSsrLifecycle,
    onServerSsrAttach: [
      (serverSsr) => {
        attachDehydratedShim(serverSsr)
      },
      ...(router.serverSsrLifecycle?.onServerSsrAttach ?? []),
    ],
  }

  Object.defineProperty(router, "serverSsr", {
    get() {
      return currentServerSsr
    },
    set(next) {
      currentServerSsr = next
      attachDehydratedShim(next)
    },
    configurable: true,
    enumerable: true,
  })

  const originalDehydrate = router.options.dehydrate
  router.options.dehydrate = async function (...args) {
    const result = await originalDehydrate?.apply(this, args)
    isDehydrated = true
    return result
  }
}

export function getRouter() {
  const queryClient = createQueryClient()

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
  })

  setupRouterSsrQueryIntegration({ router, queryClient })
  patchRouterServerSsr(router)

  return router
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
