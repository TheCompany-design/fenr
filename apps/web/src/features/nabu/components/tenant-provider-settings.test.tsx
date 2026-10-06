/**
 * The model-provider settings form, rendered.
 *
 * The presentational assertions are what a screenshot would show, written down
 * so they are checked on every run instead of once by eye: an unconfigured
 * workspace says so and offers to save; a configured one shows which key is
 * stored and never the key itself; a member sees the values and cannot touch
 * them.
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

import type { TenantProvider } from "@/lib/schemas/nabu"

import { tenantProviderKeys, tenantProviderQueryOptions } from "../queries"
import { TenantProviderSettings } from "./tenant-provider-settings"

const UNCONFIGURED: TenantProvider = {
  configured: false,
  base_url: "",
  model: "",
  fingerprint: "",
  max_output_tokens: null,
  temperature: null,
  can_administer: true,
  updated_at: "",
}

const CONFIGURED: TenantProvider = {
  configured: true,
  base_url: "https://api.openai.com/v1",
  model: "gpt-4o-mini",
  fingerprint: "a1b2c3",
  max_output_tokens: null,
  temperature: null,
  can_administer: true,
  updated_at: "2026-02-01T10:00:00Z",
}

async function render(
  provider: TenantProvider,
  canAdminister = true,
): Promise<string> {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  await queryClient.ensureQueryData({
    ...tenantProviderQueryOptions(),
    queryFn: async () => provider,
  })
  // Seeded under the real key, so the component reads exactly what it reads in
  // production rather than a parallel fixture.
  queryClient.setQueryData(tenantProviderKeys.detail(), provider)

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

describe("a workspace with no provider configured", () => {
  let html: string
  beforeEach(async () => {
    html = await render(UNCONFIGURED)
  })

  it("says so, rather than showing a form that quietly does nothing", () => {
    expect(html).toContain("no model provider")
    expect(html).toContain("turns cannot run")
  })

  it("offers to save rather than to update", () => {
    expect(html).toContain("Save provider")
  })

  it("shows an empty key field, because no key is stored", () => {
    expect(html).toContain('type="password"')
    expect(html).toContain("sk-…")
  })

  it("offers no verification, because there is nothing to verify", () => {
    // Testing an endpoint that does not exist yet would report a failure that
    // reads like a broken key rather than a missing one.
    expect(html).not.toContain("Test connection")
    expect(html).not.toContain("Remove")
  })
})

describe("a workspace with a provider configured", () => {
  let html: string
  beforeEach(async () => {
    html = await render(CONFIGURED)
  })

  it("pre-fills the endpoint and model the tenant typed", () => {
    expect(html).toContain("https://api.openai.com/v1")
    expect(html).toContain("gpt-4o-mini")
  })

  it("identifies the stored key without revealing it", () => {
    expect(html).toContain("a1b2c3")
    // The placeholder tells the reader a key exists and how to confirm it, while
    // the field itself stays empty — there is nothing to pre-fill with.
    expect(html).toContain("type to replace it")
    expect(html).not.toContain('value="sk-live')
  })

  it("offers to update, and to test and remove", () => {
    expect(html).toContain("Save changes")
    expect(html).toContain("Test connection")
    expect(html).toContain("Remove")
  })
})

describe("a member who cannot change any of this", () => {
  let html: string
  beforeEach(async () => {
    html = await render(CONFIGURED, false)
  })

  it("sees what is configured", () => {
    expect(html).toContain("gpt-4o-mini")
    expect(html).toContain("a1b2c3")
  })

  it("cannot edit any field", () => {
    // Three disabled inputs: endpoint, model, key.
    const disabled = html.match(/disabled/g) ?? []
    expect(disabled.length).toBeGreaterThanOrEqual(3)
  })

  it("is offered no way to change it, and told who to ask", () => {
    expect(html).toContain("only an owner or an admin")
    expect(html).not.toContain("Test connection")
    expect(html).not.toContain("Remove")
    // Save is present but disabled, which is different from absent: the reader
    // learns that the setting exists and that it is not theirs.
    expect(html).toContain("Save changes")
  })
})
