import { afterAll, describe, expect, it } from "bun:test"
import { QueryClient } from "@tanstack/react-query"
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router"
import { GlobalWindow } from "happy-dom"
import { act, createElement } from "react"
import { createRoot } from "react-dom/client"

import { OrganizationSettingsErrorComponent, Route } from "./organization"

// Setup DOM globals for component tests if not already defined
const originalWindow = globalThis.window
const originalDocument = globalThis.document
const originalNavigator = globalThis.navigator
const originalElement = globalThis.Element
const originalHTMLElement = globalThis.HTMLElement
const originalNode = globalThis.Node
const originalCustomElements = globalThis.customElements

if (typeof window === "undefined") {
  const win = new GlobalWindow({ url: "http://localhost:3000" })
  Object.assign(globalThis, {
    window: win,
    document: win.document,
    navigator: win.navigator,
    Element: win.Element,
    HTMLElement: win.HTMLElement,
    Node: win.Node,
    customElements: win.customElements,
    scrollTo: () => {},
    requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(cb, 0),
    cancelAnimationFrame: (id: number) => clearTimeout(id),
  })
}

afterAll(() => {
  if (originalWindow === undefined)
    delete (globalThis as Record<string, unknown>).window
  else globalThis.window = originalWindow

  if (originalDocument === undefined)
    delete (globalThis as Record<string, unknown>).document
  else globalThis.document = originalDocument

  if (originalNavigator === undefined)
    delete (globalThis as Record<string, unknown>).navigator
  else globalThis.navigator = originalNavigator

  if (originalElement === undefined)
    delete (globalThis as Record<string, unknown>).Element
  else globalThis.Element = originalElement

  if (originalHTMLElement === undefined)
    delete (globalThis as Record<string, unknown>).HTMLElement
  else globalThis.HTMLElement = originalHTMLElement

  if (originalNode === undefined)
    delete (globalThis as Record<string, unknown>).Node
  else globalThis.Node = originalNode

  if (originalCustomElements === undefined)
    delete (globalThis as Record<string, unknown>).customElements
  else globalThis.customElements = originalCustomElements
})

describe("/settings/organization route", () => {
  it("exports route with correct path and prefetching loader", async () => {
    expect(Route).toBeDefined()
    expect(typeof Route.options.loader).toBe("function")

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    const mockOrg = {
      id: "018f1a1a-0000-7000-8000-000000000001",
      name: "Fenr Labs",
      slug: "fenr-labs",
      logo: null,
      createdAt: new Date(),
    }

    const ensureQueryDataSpy: unknown[][] = []
    queryClient.ensureQueryData = ((options: {
      queryKey: readonly unknown[]
    }) => {
      ensureQueryDataSpy.push([...options.queryKey])
      return Promise.resolve([])
    }) as typeof queryClient.ensureQueryData

    const loader = Route.options.loader
    if (typeof loader === "function") {
      await (loader as (args: unknown) => Promise<unknown>)({
        context: {
          queryClient,
          activeOrganization: {
            organization: mockOrg,
            role: "owner",
            memberCount: 2,
          },
        },
      })
    }

    expect(ensureQueryDataSpy).toEqual([
      ["organizations", "members", mockOrg.id],
      ["organizations", "invitations", mockOrg.id],
    ])
  })

  it("skips invitations prefetching for regular member role", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    const mockOrg = {
      id: "018f1a1a-0000-7000-8000-000000000001",
      name: "Fenr Labs",
      slug: "fenr-labs",
      logo: null,
      createdAt: new Date(),
    }

    const ensureQueryDataSpy: unknown[][] = []
    queryClient.ensureQueryData = ((options: {
      queryKey: readonly unknown[]
    }) => {
      ensureQueryDataSpy.push([...options.queryKey])
      return Promise.resolve([])
    }) as typeof queryClient.ensureQueryData

    const loader = Route.options.loader
    if (typeof loader === "function") {
      await (loader as (args: unknown) => Promise<unknown>)({
        context: {
          queryClient,
          activeOrganization: {
            organization: mockOrg,
            role: "member",
            memberCount: 2,
          },
        },
      })
    }

    expect(ensureQueryDataSpy).toEqual([
      ["organizations", "members", mockOrg.id],
    ])
  })

  it("registers OrganizationSettingsErrorComponent as route-scoped errorComponent", () => {
    expect(Route.options.errorComponent).toBeDefined()
    expect(Route.options.errorComponent).toBe(
      OrganizationSettingsErrorComponent,
    )
  })

  describe("OrganizationSettingsErrorComponent", () => {
    it("renders route error UI inside settings container and handles retry", async () => {
      let invalidateCalled = false
      let resetCalled = false

      const rootRoute = createRootRoute({
        component: () =>
          createElement(OrganizationSettingsErrorComponent, {
            error: new Error("Settings fetch failed"),
            reset: () => {
              resetCalled = true
            },
          }),
      })
      const router = createRouter({
        routeTree: rootRoute,
        history: createMemoryHistory(),
      })
      router.invalidate = async () => {
        invalidateCalled = true
      }
      await router.load()

      const container = document.createElement("div")
      document.body.appendChild(container)
      const root = createRoot(container)

      await act(async () => {
        root.render(createElement(RouterProvider, { router }))
      })

      expect(container.innerHTML).toContain(
        "Unable to load organization settings",
      )
      const button = container.querySelector("button")
      expect(button).not.toBeNull()
      expect(button?.textContent).toContain("Try again")

      await act(async () => {
        button?.click()
      })

      expect(invalidateCalled).toBe(true)
      expect(resetCalled).toBe(true)

      act(() => {
        root.unmount()
      })
      container.remove()
    })

    it("guards against concurrent retry clicks in OrganizationSettingsErrorComponent", async () => {
      let invalidateCalls = 0
      let resolveInvalidate: () => void = () => {}
      const invalidatePromise = new Promise<void>((resolve) => {
        resolveInvalidate = resolve
      })

      const rootRoute = createRootRoute({
        component: () =>
          createElement(OrganizationSettingsErrorComponent, {
            error: new Error("Settings fetch failed"),
            reset: () => {},
          }),
      })
      const router = createRouter({
        routeTree: rootRoute,
        history: createMemoryHistory(),
      })
      router.invalidate = async () => {
        invalidateCalls++
        return invalidatePromise
      }
      await router.load()

      const container = document.createElement("div")
      document.body.appendChild(container)
      const root = createRoot(container)

      await act(async () => {
        root.render(createElement(RouterProvider, { router }))
      })

      const button = container.querySelector("button")
      expect(button).not.toBeNull()

      await act(async () => {
        button?.click()
      })
      expect(invalidateCalls).toBe(1)
      expect(button?.textContent).toContain("Retrying...")
      expect(button?.hasAttribute("disabled")).toBe(true)

      // Concurrent click ignored
      await act(async () => {
        button?.click()
      })
      expect(invalidateCalls).toBe(1)

      // Finish in-flight invalidation
      await act(async () => {
        resolveInvalidate()
      })

      expect(button?.textContent).toContain("Try again")
      expect(button?.hasAttribute("disabled")).toBe(false)

      act(() => {
        root.unmount()
      })
      container.remove()
    })
  })
})
