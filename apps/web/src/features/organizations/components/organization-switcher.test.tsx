import { describe, expect, it } from "bun:test"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router"
import { GlobalWindow } from "happy-dom"
import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import { renderToStaticMarkup } from "react-dom/server"

import { organizationKeys } from "../queries"
import { OrganizationSwitcher } from "./organization-switcher"

// Setup DOM globals for interactive dropdown tests
const win = new GlobalWindow({ url: "http://localhost:3000" })
Object.assign(globalThis, {
  window: win,
  document: win.document,
  navigator: win.navigator,
  HTMLElement: win.HTMLElement,
  customElements: win.customElements,
  scrollTo: () => {},
  requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(cb, 0),
  cancelAnimationFrame: (id: number) => clearTimeout(id),
})

function createTestRouter(component: () => React.ReactNode) {
  const rootRoute = createRootRoute({ component })
  return createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory(),
  })
}

async function renderWithProviders(
  component: () => React.ReactNode,
  queryClient: QueryClient,
) {
  const router = createTestRouter(() =>
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(component),
    ),
  )
  await router.load()
  return renderToStaticMarkup(createElement(RouterProvider, { router }))
}

describe("OrganizationSwitcher (Atom 8)", () => {
  it("renders active organization name, avatar initial, and switch trigger", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    const activeOrg = {
      organization: {
        id: "018f1a1a-0000-7000-8000-000000000001",
        name: "Fenr Studios",
        slug: "fenr-studios",
        logo: null,
        createdAt: new Date(),
      },
      role: "owner" as const,
      joinedAt: new Date(),
      memberCount: 5,
    }

    const html = await renderWithProviders(
      () =>
        createElement(OrganizationSwitcher, { activeOrganization: activeOrg }),
      queryClient,
    )

    expect(html).toContain("Fenr Studios")
    expect(html).toContain("Current workspace: Fenr Studios")
    expect(html).toContain(
      'aria-label="Current workspace: Fenr Studios. Click to switch organization."',
    )
    expect(html).toContain("F")
  })

  it("renders fallback text when no active organization is present", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    const html = await renderWithProviders(
      () => createElement(OrganizationSwitcher, { activeOrganization: null }),
      queryClient,
    )

    expect(html).toContain("Select organization")
    expect(html).toContain("?")
  })

  it("renders organization list, role badges, and active indicators when opened", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    const testOrgs = [
      {
        id: "org-1",
        name: "Acme Corp",
        slug: "acme-corp",
        logo: null,
        role: "owner" as const,
        memberCount: 3,
        isActive: true,
      },
      {
        id: "org-2",
        name: "Beta Labs",
        slug: "beta-labs",
        logo: null,
        role: "member" as const,
        memberCount: 12,
        isActive: false,
      },
    ]

    queryClient.setQueryData(organizationKeys.lists(), testOrgs)

    const container = document.createElement("div")
    document.body.appendChild(container)
    const root = createRoot(container)

    const router = createTestRouter(() =>
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(OrganizationSwitcher, {
          defaultOpen: true,
          activeOrganization: {
            organization: {
              id: "org-1",
              name: "Acme Corp",
              slug: "acme-corp",
              logo: null,
              createdAt: new Date(),
            },
            role: "owner",
            joinedAt: new Date(),
            memberCount: 3,
          },
        }),
      ),
    )

    await router.load()

    await act(async () => {
      root.render(createElement(RouterProvider, { router }))
    })

    // Allow effects and portal mounting to process
    await new Promise((resolve) => setTimeout(resolve, 50))

    const bodyHtml = document.body.innerHTML
    expect(bodyHtml).toContain("Beta Labs")
    expect(bodyHtml).toContain("owner")
    expect(bodyHtml).toContain("member")
    expect(bodyHtml).toContain("fenr.app/beta-labs")
    expect(bodyHtml).toContain("Organizations")

    root.unmount()
    container.remove()
  })
})
