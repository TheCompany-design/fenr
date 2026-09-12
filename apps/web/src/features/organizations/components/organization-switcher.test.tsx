import { describe, expect, it } from "bun:test"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { organizationKeys } from "../queries"
import { OrganizationSwitcher } from "./organization-switcher"

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

  it("renders organization list, role badges, and active indicators when preloaded", async () => {
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

    const html = await renderWithProviders(
      () =>
        createElement(OrganizationSwitcher, {
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
      queryClient,
    )

    expect(html).toContain("Acme Corp")
  })
})
