/**
 * The saved-providers settings screen, rendered.
 *
 * The presentational assertions are what a screenshot would show, written down
 * so they are checked on every run instead of once by eye: an empty workspace
 * says so and offers to add; a workspace with two entries shows which one new
 * conversations start on, names every stored key by its fingerprint, and never
 * shows a key; a member sees the list and cannot touch it.
 *
 * Rendered server-side with a seeded query client, because that is the closest
 * thing to "what a browser gets" available without a session — and because the
 * assertions worth making are about what is *absent* as much as what is present.
 */

import { beforeEach, describe, expect, it } from "bun:test"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import type { TenantProviderSummary } from "@/lib/schemas/nabu"

import { tenantProviderKeys, tenantProvidersQueryOptions } from "../queries"
import { TenantProviderSettings } from "./tenant-provider-settings"

const DEFAULT_ENTRY: TenantProviderSummary = {
  id: "018f0000-0000-7000-8000-000000000001",
  provider: "openai",
  model: "gpt-4o-mini",
  label: "Work key",
  is_default: true,
  fingerprint: "a1b2c3",
  max_output_tokens: null,
  temperature: null,
  updated_at: "2026-02-01T10:00:00Z",
}

const SECOND_ENTRY: TenantProviderSummary = {
  id: "018f0000-0000-7000-8000-000000000002",
  provider: "anthropic",
  model: "claude-sonnet-4-5",
  label: null,
  is_default: false,
  fingerprint: "9f8e7d",
  max_output_tokens: null,
  temperature: null,
  updated_at: "2026-02-02T10:00:00Z",
}

async function render(
  list: { providers: TenantProviderSummary[]; can_administer: boolean },
  canAdminister = true,
): Promise<string> {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  await queryClient.ensureQueryData({
    ...tenantProvidersQueryOptions(),
    queryFn: async () => list,
  })
  // Seeded under the real key, so the component reads exactly what it reads in
  // production rather than a parallel fixture.
  queryClient.setQueryData(tenantProviderKeys.list(), list)

  const rootRoute = createRootRoute({
    component: () =>
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(TenantProviderSettings, { canAdminister }),
      ),
  })
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ["/settings/provider"] }),
  })
  await router.load()

  return renderToStaticMarkup(createElement(RouterProvider, { router }))
}

describe("a workspace with no provider saved", () => {
  let html: string
  beforeEach(async () => {
    html = await render({ providers: [], can_administer: true })
  })

  it("says so, rather than rendering a list that quietly does nothing", () => {
    expect(html).toContain("no model provider")
    expect(html).toContain("turns cannot run")
  })

  it("offers to add the first one", () => {
    expect(html).toContain("Add a provider")
  })

  it("offers no per-entry actions, because there are no entries", () => {
    expect(html).not.toContain("Test")
    expect(html).not.toContain("Remove")
  })
})

describe("a workspace with providers saved", () => {
  let html: string
  beforeEach(async () => {
    html = await render({
      providers: [DEFAULT_ENTRY, SECOND_ENTRY],
      can_administer: true,
    })
  })

  it("renders every entry, naming the label and the model", () => {
    expect(html).toContain("Work key")
    expect(html).toContain("gpt-4o-mini")
    expect(html).toContain("claude-sonnet-4-5")
  })

  it("marks the one new conversations start on", () => {
    expect(html).toContain("New chats start here")
    expect(html).toContain("Use for new chats")
  })

  it("identifies each stored key without revealing it", () => {
    expect(html).toContain("a1b2c3")
    expect(html).toContain("9f8e7d")
    expect(html).not.toContain("sk-")
  })

  it("offers to test and remove each entry, and to add another", () => {
    expect(html).toContain("Test")
    expect(html).toContain("Remove")
    expect(html).toContain("Add a provider")
  })
})

describe("a member who cannot change any of this", () => {
  let html: string
  beforeEach(async () => {
    html = await render(
      { providers: [DEFAULT_ENTRY, SECOND_ENTRY], can_administer: true },
      false,
    )
  })

  it("sees what is saved", () => {
    expect(html).toContain("Work key")
    expect(html).toContain("a1b2c3")
  })

  it("is offered no way to change it, and told who to ask", () => {
    expect(html).toContain("only an owner or an admin")
    expect(html).not.toContain("Add a provider")
    expect(html).not.toContain("Test")
    expect(html).not.toContain("Remove")
  })
})
