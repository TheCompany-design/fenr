/**
 * What the chat surface tells someone about their workspace's provider.
 *
 * The presentational half is tested directly. Rendering it needs a query client
 * and a router, and the part worth asserting — that an unconfigured workspace
 * says so, that a member is not offered a link they cannot use, and that the
 * endpoint's path never appears — is all in the props.
 */

import { describe, expect, it } from "bun:test"
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import type { TenantProvider } from "@/lib/schemas/nabu"

import { endpointOrigin, ProviderNotice } from "./provider-notice"

/**
 * Render inside a router, because the notice links to settings and a `Link`
 * without one throws rather than degrading.
 */
async function render(props: {
  provider: TenantProvider
  canAdminister: boolean
}): Promise<string> {
  const rootRoute = createRootRoute({
    component: () => createElement(ProviderNotice, props),
  })
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ["/chat"] }),
  })
  await router.load()
  return renderToStaticMarkup(createElement(RouterProvider, { router }))
}

const UNCONFIGURED: TenantProvider = {
  configured: false,
  base_url: "",
  model: "",
  fingerprint: "",
  max_output_tokens: null,
  temperature: null,
  can_administer: false,
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

describe("an unconfigured workspace", () => {
  it("says a turn cannot run, before anyone types one", async () => {
    const html = await render({ provider: UNCONFIGURED, canAdminister: true })
    expect(html).toContain("no model provider")
    expect(html).toContain("cannot run")
  })

  it("is announced as a status, not left to be noticed", async () => {
    const html = await render({ provider: UNCONFIGURED, canAdminister: true })
    expect(html).toContain('role="status"')
  })

  it("offers an admin a way to fix it", async () => {
    const html = await render({ provider: UNCONFIGURED, canAdminister: true })
    expect(html).toContain('href="/settings/provider"')
  })

  it("tells a member to ask rather than offering a link they will be refused on", async () => {
    const html = await render({
      provider: UNCONFIGURED,
      canAdminister: false,
    })
    expect(html).toContain("Ask an admin")
    // The point: a link to a screen that answers 403 is worse than no link.
    expect(html).not.toContain('href="/settings/provider"')
  })
})

describe("a configured workspace", () => {
  it("names the model the conversation is actually running on", async () => {
    const html = await render({ provider: CONFIGURED, canAdminister: true })
    expect(html).toContain("gpt-4o-mini")
    expect(html).toContain("Running on")
  })

  it("shows only the origin, never the path", async () => {
    const html = await render({
      provider: {
        ...CONFIGURED,
        // A path a workspace may consider private, and a query it certainly does.
        base_url: "https://gateway.internal/tenant/acme/private/v1?token=zzz",
      },
      canAdminister: true,
    })
    expect(html).toContain("gateway.internal")
    expect(html).not.toContain("acme")
    expect(html).not.toContain("private")
    expect(html).not.toContain("token=zzz")
  })

  it("never renders the credential fingerprint", async () => {
    // The fingerprint is for the settings screen, where it confirms a save. In a
    // chat header it is six meaningless hex digits.
    const html = await render({ provider: CONFIGURED, canAdminister: true })
    expect(html).not.toContain("a1b2c3")
  })

  it("does not announce itself, because it is not a problem", async () => {
    const html = await render({ provider: CONFIGURED, canAdminister: true })
    expect(html).not.toContain('role="status"')
  })

  it("still offers a member a way to see what is in use", async () => {
    const html = await render({ provider: CONFIGURED, canAdminister: false })
    expect(html).toContain("gpt-4o-mini")
    expect(html).not.toContain('href="/settings/provider"')
  })
})

describe("reading an endpoint origin", () => {
  it("keeps only scheme and authority", () => {
    expect(endpointOrigin("https://api.example.com/v1")).toBe("api.example.com")
    expect(endpointOrigin("http://localhost:11434/v1")).toBe("localhost:11434")
  })

  it("returns null for something unparseable rather than throwing", () => {
    // The banner must still render when a stored value is odd — an empty badge
    // is recoverable, a crashed chat header is not.
    expect(endpointOrigin("")).toBeNull()
    expect(endpointOrigin("not a url")).toBeNull()
    expect(endpointOrigin("/relative/path")).toBeNull()
  })
})
