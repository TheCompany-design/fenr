/**
 * Workspace switcher — behaviour of the sidebar trigger and the popup.
 *
 * The switcher now lives inside the sidebar, so every render is wrapped in a
 * real SidebarProvider/Sidebar: the trigger reads the sidebar's collapsed
 * state, and the popup picks its opening side from it.
 *
 * `getBoundingClientRect` is stubbed with a non-zero rect so the dropdown's
 * portal positioning can be asserted — that is what proves the dropdown's ref
 * actually reached the sidebar button instead of silently falling back to the
 * origin.
 */
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router"
import { Sidebar, SidebarProvider } from "@workspace/ui/components/sidebar"
import { TooltipProvider } from "@workspace/ui/components/tooltip"
import { act, createElement, type ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { renderToStaticMarkup } from "react-dom/server"

import { organizationKeys } from "../queries"
import { OrganizationSwitcher } from "./organization-switcher"

const mockSetActiveOrganization = mock(async () => ({ success: true }))

mock.module("../server", () => ({
  // `queries.ts` imports the list function at module scope; the switcher only
  // ever reads it through an already-seeded cache, so a rejecting stub is
  // enough to keep a stray refetch from reaching the network.
  listOrganizationsFn: mock(async () => {
    throw new Error("listOrganizationsFn should not run in this test")
  }),
  setActiveOrganizationFn: mockSetActiveOrganization,
}))

// The sidebar asks the viewport whether it is on mobile; the popup's opening
// side depends on the answer, so it must be deterministic.
window.matchMedia = ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false,
})) as unknown as typeof window.matchMedia

const TRIGGER_RECT = {
  x: 24,
  y: 40,
  left: 24,
  top: 40,
  right: 264,
  bottom: 88,
  width: 240,
  height: 48,
  toJSON: () => ({}),
}

const ACTIVE_ORGANIZATION = {
  organization: {
    id: "018f1a1a-0000-7000-8000-000000000001",
    name: "Osh Studio",
    slug: "osh-studio",
    logo: null,
    createdAt: new Date(),
  },
  role: "owner",
  joinedAt: new Date(),
  memberCount: 5,
}

const WORKSPACES = [
  {
    id: ACTIVE_ORGANIZATION.organization.id,
    name: "Osh Studio",
    slug: "osh-studio",
    logo: null,
    createdAt: new Date(),
    role: "owner",
    memberId: "member-1",
    joinedAt: new Date(),
    memberCount: 5,
    isActive: true,
  },
  {
    id: "018f1a1a-0000-7000-8000-000000000002",
    name: "Personal",
    slug: "personal",
    logo: null,
    createdAt: new Date(),
    role: "owner",
    memberId: "member-2",
    joinedAt: new Date(),
    memberCount: 1,
    isActive: false,
  },
]

let container: HTMLDivElement
let root: Root
let queryClient: QueryClient

function createTestRouter(node: () => ReactNode) {
  const rootRoute = createRootRoute({ component: node })
  return createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory(),
  })
}

function wrap(
  node: ReactNode,
  { sidebarOpen = true }: { sidebarOpen?: boolean } = {},
) {
  return createElement(
    TooltipProvider,
    null,
    createElement(
      SidebarProvider,
      { defaultOpen: sidebarOpen },
      createElement(
        Sidebar,
        { collapsible: "icon", variant: "floating" },
        node,
      ),
    ),
  )
}

async function render(
  node: ReactNode,
  {
    sidebarOpen = true,
    seed = true,
    workspaces = WORKSPACES,
  }: { sidebarOpen?: boolean; seed?: boolean; workspaces?: unknown[] } = {},
) {
  if (seed) {
    queryClient.setQueryData(organizationKeys.lists(), workspaces)
  }
  const router = createTestRouter(() =>
    createElement(
      QueryClientProvider,
      { client: queryClient },
      wrap(node, { sidebarOpen }),
    ),
  )
  await router.load()
  await act(async () => {
    root.render(createElement(RouterProvider, { router }))
  })
  // Two frames: one for the effects to mount the portal, one for the
  // dropdown to measure itself and commit a position.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 60))
  })
}

async function renderStatic(node: ReactNode) {
  const router = createTestRouter(() =>
    createElement(QueryClientProvider, { client: queryClient }, wrap(node)),
  )
  await router.load()
  return renderToStaticMarkup(createElement(RouterProvider, { router }))
}

/**
 * happy-dom's event classes do not structurally satisfy the DOM lib's
 * `Event`, so the dispatched object is cast at the boundary. `pointerType`
 * is what the glider reads to tell a hover from a tap.
 */
function pointerMove(pointerType: "mouse" | "touch") {
  const event = new window.Event("pointermove", { bubbles: true })
  return Object.assign(event, { pointerType }) as unknown as Event
}

function portal() {
  return document.querySelector<HTMLElement>("[data-animated-dropdown-portal]")
}

beforeEach(() => {
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  mockSetActiveOrganization.mockClear()
  // Every element reports the same box; only the trigger's matters, and the
  // dropdown reads exactly one trigger rect plus one content rect.
  Element.prototype.getBoundingClientRect = () => ({ ...TRIGGER_RECT })
})

afterEach(() => {
  act(() => {
    root.unmount()
  })
  container.remove()
  document.body.innerHTML = ""
  queryClient.clear()
})

describe("OrganizationSwitcher trigger", () => {
  it("shows the active workspace name, initial and an explicit label", async () => {
    const html = await renderStatic(
      createElement(OrganizationSwitcher, {
        activeOrganization: ACTIVE_ORGANIZATION,
      }),
    )

    expect(html).toContain("Osh Studio")
    expect(html).toContain(
      'aria-label="Current workspace: Osh Studio. Click to switch workspace."',
    )
    expect(html).toContain(">O<")
    // Circular avatars: the shape class survives alongside the size.
    expect(html).toContain("rounded-full")
  })

  it("falls back to a prompt when no workspace is active", async () => {
    const html = await renderStatic(
      createElement(OrganizationSwitcher, { activeOrganization: null }),
    )

    expect(html).toContain("Select workspace")
  })

  it("keeps the workspace name in the tooltip for the collapsed icon rail", async () => {
    const html = await renderStatic(
      createElement(OrganizationSwitcher, {
        activeOrganization: ACTIVE_ORGANIZATION,
      }),
    )

    // The collapsed rail hides the label visually; the tooltip content is
    // what carries the name there.
    expect(html).toContain("Osh Studio")
  })
})

describe("OrganizationSwitcher popup", () => {
  it("lists workspaces as radio items and marks only the active one", async () => {
    await render(
      createElement(OrganizationSwitcher, {
        defaultOpen: true,
        activeOrganization: ACTIVE_ORGANIZATION,
      }),
    )

    const options = document.querySelectorAll<HTMLElement>(
      '[role="menuitemradio"]',
    )
    expect(options.length).toBe(2)
    expect(options[0]?.getAttribute("aria-checked")).toBe("true")
    expect(options[1]?.getAttribute("aria-checked")).toBe("false")

    expect(document.body.innerHTML).toContain("Workspaces")
    expect(document.body.innerHTML).toContain("Personal")

    // The active marker rides inside the checked row, never a sibling row.
    const activeMarker = document.querySelector(
      "[data-testid='workspace-active-marker']",
    )
    expect(activeMarker).not.toBeNull()
    expect(activeMarker?.closest("[role='menuitemradio']")).toBe(options[0])

    // Slug URLs and role badges were dropped from the redesigned rows.
    expect(document.body.innerHTML).not.toContain("fenr.app/")
    expect(document.body.innerHTML).not.toContain(">owner<")
  })

  it("offers an add-workspace action below a separator", async () => {
    await render(
      createElement(OrganizationSwitcher, {
        defaultOpen: true,
        activeOrganization: ACTIVE_ORGANIZATION,
      }),
    )

    const add = document.querySelector<HTMLElement>(
      '[data-testid="workspace-add"]',
    )
    expect(add).not.toBeNull()
    expect(add?.getAttribute("role")).toBe("menuitem")
    expect(add?.textContent).toContain("Add new workspace")
  })

  it("tags every row for arrow-key navigation", async () => {
    await render(
      createElement(OrganizationSwitcher, {
        defaultOpen: true,
        activeOrganization: ACTIVE_ORGANIZATION,
      }),
    )

    const focusable = document.querySelectorAll(
      '[data-menu-item="true"]:not([disabled])',
    )
    expect(focusable.length).toBe(3) // two workspaces + add
  })

  it("moves one glide pill onto whichever row the pointer is over", async () => {
    await render(
      createElement(OrganizationSwitcher, {
        defaultOpen: true,
        activeOrganization: ACTIVE_ORGANIZATION,
      }),
    )

    // No row carries a hover background of its own — the pill replaces it,
    // so a second highlight underneath would stop reading as hover.
    const row = document.querySelector<HTMLElement>('[role="menuitemradio"]')
    expect(row?.className).not.toContain("hover:bg-accent")

    const second = document.querySelectorAll<HTMLElement>(
      '[role="menuitemradio"]',
    )[1]

    // Nothing holds the pill until the pointer or focus arrives.
    expect(
      Array.from(document.querySelectorAll<HTMLElement>("[data-glide-pill]")),
    ).toEqual([])

    // Pointer move claims the pill; `pointerType: mouse` stands in for hover.
    await act(async () => {
      second?.dispatchEvent(pointerMove("mouse"))
    })

    const after = Array.from(
      document.querySelectorAll<HTMLElement>("[data-glide-pill]"),
    ).map((el) => el.closest("[data-menu-item]")?.getAttribute("role"))

    // Exactly one pill, and it sits on the row under the pointer.
    expect(after).toEqual(["menuitemradio"])
    expect(second?.querySelector("[data-glide-pill]")).not.toBeNull()
    expect(row?.querySelector("[data-glide-pill]")).toBeNull()
  })

  it("leaves the pill alone on touch pointers", async () => {
    await render(
      createElement(OrganizationSwitcher, {
        defaultOpen: true,
        activeOrganization: ACTIVE_ORGANIZATION,
      }),
    )

    const second = document.querySelectorAll<HTMLElement>(
      '[role="menuitemradio"]',
    )[1]

    await act(async () => {
      second?.dispatchEvent(pointerMove("touch"))
    })

    expect(document.querySelectorAll("[data-glide-pill]").length).toBe(0)
  })

  it("hands the pill to the row that takes keyboard focus", async () => {
    await render(
      createElement(OrganizationSwitcher, {
        defaultOpen: true,
        activeOrganization: ACTIVE_ORGANIZATION,
      }),
    )

    const add = document.querySelector<HTMLElement>(
      '[data-testid="workspace-add"]',
    )

    await act(async () => {
      add?.focus()
      add?.dispatchEvent(
        new window.FocusEvent("focus", { bubbles: true }) as unknown as Event,
      )
    })

    expect(add?.querySelector("[data-glide-pill]")).not.toBeNull()
  })

  it("closes without calling the server when the active workspace is picked again", async () => {
    await render(
      createElement(OrganizationSwitcher, {
        defaultOpen: true,
        activeOrganization: ACTIVE_ORGANIZATION,
      }),
    )

    expect(portal()).not.toBeNull()
    const activeOption = document.querySelector<HTMLElement>(
      '[role="menuitemradio"][aria-checked="true"]',
    )

    await act(async () => {
      activeOption?.click()
    })

    expect(mockSetActiveOrganization).not.toHaveBeenCalled()
  })

  it("surfaces a retry affordance when the workspace list fails", async () => {
    // No seed → the list query runs, hits the throwing stub and fails.
    await render(
      createElement(OrganizationSwitcher, {
        defaultOpen: true,
        activeOrganization: ACTIVE_ORGANIZATION,
      }),
      { seed: false },
    )

    expect(document.body.innerHTML).toContain("Could not load your workspaces.")
    const retry = Array.from(
      document.querySelectorAll<HTMLElement>("button"),
    ).find((button) => button.textContent === "Retry")
    expect(retry).toBeDefined()

    // The add-workspace path stays reachable: a failed read must not lock the
    // user out of creating the workspace they were trying to reach.
    const add = document.querySelector<HTMLElement>(
      '[data-testid="workspace-add"]',
    )
    expect(add?.hasAttribute("disabled")).toBe(false)
  })

  it("explains an empty list instead of rendering a blank popup", async () => {
    await render(
      createElement(OrganizationSwitcher, {
        defaultOpen: true,
        activeOrganization: null,
      }),
      { workspaces: [] },
    )

    expect(document.body.innerHTML).toContain(
      "You are not a member of any workspace yet.",
    )
    expect(document.querySelectorAll("[role='menuitemradio']").length).toBe(0)
  })

  it("opens below the trigger when the rail is expanded", async () => {
    await render(
      createElement(OrganizationSwitcher, {
        defaultOpen: true,
        activeOrganization: ACTIVE_ORGANIZATION,
      }),
    )

    // side="bottom", align="start", sideOffset 6 → anchored to the trigger's
    // left edge, just under its bottom. A dropped ref would leave this at 0.
    expect(portal()?.style.left).toBe(`${TRIGGER_RECT.left}px`)
    expect(portal()?.style.top).toBe(`${TRIGGER_RECT.bottom + 6}px`)
  })

  it("opens beside the trigger when the rail is collapsed", async () => {
    await render(
      createElement(OrganizationSwitcher, {
        defaultOpen: true,
        activeOrganization: ACTIVE_ORGANIZATION,
      }),
      { sidebarOpen: false },
    )

    // side="right", align="start", sideOffset 10
    expect(portal()?.style.left).toBe(`${TRIGGER_RECT.right + 10}px`)
    expect(portal()?.style.top).toBe(`${TRIGGER_RECT.top}px`)
  })

  it("opens the popup when the sidebar trigger itself is clicked", async () => {
    await render(
      createElement(OrganizationSwitcher, {
        activeOrganization: ACTIVE_ORGANIZATION,
      }),
      { seed: false },
    )
    expect(portal()).toBeNull()

    const trigger = document.querySelector<HTMLElement>(
      '[aria-label^="Current workspace"]',
    )
    expect(trigger?.getAttribute("aria-haspopup")).toBe("menu")
    expect(trigger?.getAttribute("aria-expanded")).toBe("false")

    await act(async () => {
      trigger?.click()
      await new Promise((resolve) => setTimeout(resolve, 60))
    })

    expect(portal()).not.toBeNull()
    expect(trigger?.getAttribute("aria-expanded")).toBe("true")
  })
})
