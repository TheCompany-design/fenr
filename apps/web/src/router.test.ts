import { describe, expect, it } from "bun:test"
import { getRouter } from "./router"

describe("getRouter SSR Query Integration", () => {
  it("provides isDehydrated() on serverSsr to prevent TypeError during SSR query events", async () => {
    const router = getRouter()
    const queryClient = router.options.context.queryClient

    // Mock the serverSsr object attached by TanStack Router during SSR
    const mockServerSsr: Record<string, unknown> = {
      onRenderFinished: () => {},
      cleanup: () => {},
    }

    // Attach serverSsr as TanStack Router's attachRouterServerSsrUtils would
    ;(router as unknown as { serverSsr: unknown }).serverSsr = mockServerSsr

    const serverSsr = (
      router as unknown as {
        serverSsr: { isDehydrated: () => boolean }
      }
    ).serverSsr

    expect(typeof serverSsr.isDehydrated).toBe("function")
    expect(serverSsr.isDehydrated()).toBe(false)

    // Triggering a query cache update during SSR should not throw
    expect(() => {
      queryClient.setQueryData(["test-query"], { data: "hello" })
    }).not.toThrow()

    // Before dehydrate runs, isDehydrated remains false
    expect(serverSsr.isDehydrated()).toBe(false)

    // Call dehydrate
    if (router.options.dehydrate) {
      await router.options.dehydrate()
    }

    // After dehydrate runs, isDehydrated becomes true
    expect(serverSsr.isDehydrated()).toBe(true)
  })

  it("handles serverSsr attached via onServerSsrAttach lifecycle", async () => {
    const router = getRouter()

    const mockServerSsr: Record<string, unknown> = {
      onRenderFinished: () => {},
    }

    // Trigger onServerSsrAttach listeners
    for (const listener of router.serverSsrLifecycle?.onServerSsrAttach ?? []) {
      listener(mockServerSsr as never)
    }

    const typedServerSsr = mockServerSsr as {
      isDehydrated?: () => boolean
    }
    expect(typeof typedServerSsr.isDehydrated).toBe("function")
    expect(typedServerSsr.isDehydrated?.()).toBe(false)
  })
})
