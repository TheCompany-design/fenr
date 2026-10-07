/**
 * Does clicking "Save provider" actually reach the server function?
 *
 * Written because a workspace administrator clicked save and the fields came back
 * empty, with nothing written. The Nabu side was proven correct against the real
 * database, so the question moved to this side: is the submit handler reaching the
 * mutation at all, and with the payload the schema expects?
 *
 * The fields clearing is the second half of that question and is asserted here
 * too, because "the form re-seeds itself from the query" is the most likely way a
 * successful save could look like a failed one.
 */

import { beforeEach, describe, expect, it, mock } from "bun:test"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router"
import { act, createElement } from "react"
import { createRoot } from "react-dom/client"

import type { TenantProvider } from "@/lib/schemas/nabu"

/** What the server functions were asked to do, in order. */
const calls: {
  put: unknown[]
  verify: number
  remove: number
} = { put: [], verify: 0, remove: 0 }

/**
 * What the read returns after a save.
 *
 * Mutable, because the bug under test is a form that re-seeds from a stale read.
 * A test double that always returns the same value cannot show that.
 */
let stored: TenantProvider = {
  configured: false,
  base_url: "",
  model: "",
  fingerprint: "",
  max_output_tokens: null,
  temperature: null,
  can_administer: true,
  updated_at: "",
}

// The specifier must match the one the component under test uses, or Bun's module
// mock misses and the *real* server function runs — which fails for reasons that
// have nothing to do with what this test is about.
mock.module("../tenant-provider.functions", () => ({
  putTenantProviderFn: async (payload: unknown) => {
    calls.put.push(payload)
    const data = (payload as { data: Record<string, unknown> }).data
    stored = {
      ...stored,
      configured: true,
      base_url: String(data.base_url),
      model: String(data.model),
      fingerprint: "a1b2c3",
      updated_at: new Date().toISOString(),
    }
    return stored
  },
  deleteTenantProviderFn: async () => {
    calls.remove += 1
    stored = { ...stored, configured: false, base_url: "", model: "" }
  },
  verifyTenantProviderFn: async () => {
    calls.verify += 1
    return { ok: true, message: "reachable" }
  },
  getTenantProviderFn: async () => stored,
}))

mock.module("sonner", () => ({
  toast: Object.assign(() => {}, {
    success: () => {},
    error: () => {},
    warning: () => {},
  }),
}))

const { TenantProviderSettings } = await import("./tenant-provider-settings")
const { tenantProviderKeys, tenantProviderQueryOptions } = await import(
  "../queries"
)

/**
 * happy-dom's elements and the ambient DOM lib's are structurally unrelated, so
 * the container is narrowed once here rather than casting at every call site.
 * Everything below treats it as a real DOM node, which is what the code under
 * test does.
 */
let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

async function mount(provider: TenantProvider) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  await queryClient.ensureQueryData({
    ...tenantProviderQueryOptions(),
    queryFn: async () => provider,
  })
  queryClient.setQueryData(tenantProviderKeys.detail(), provider)

  const rootRoute = createRootRoute({
    component: () =>
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(TenantProviderSettings, { canAdminister: true }),
      ),
  })
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ["/settings/provider"] }),
  })
  await router.load()

  container = window.document.createElement("div") as unknown as HTMLDivElement
  ;(window.document.body as unknown as HTMLBodyElement).appendChild(container)
  root = createRoot(container)

  act(() => {
    root.render(createElement(RouterProvider, { router }))
  })
  return { queryClient, router }
}

/** Types into a field the way a person does: set value, then fire `input`. */
function type(fieldId: string, value: string) {
  const input = container.querySelector<HTMLInputElement>(`#${fieldId}`)
  if (!input) throw new Error(`no field ${fieldId}`)

  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  )?.set
  setter?.call(input, value)

  act(() => {
    input.dispatchEvent(
      new window.Event("input", { bubbles: true }) as unknown as Event,
    )
  })
}

function field(fieldId: string): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>(`#${fieldId}`)
  if (!input) throw new Error(`no field ${fieldId}`)
  return input
}

function buttonLabelled(text: string): HTMLElement {
  const found = Array.from(container.querySelectorAll("button")).find((b) =>
    (b.textContent ?? "").includes(text),
  ) as HTMLElement | undefined
  if (!found) {
    throw new Error(
      `no button labelled "${text}"; saw: ${Array.from(
        container.querySelectorAll("button"),
      )
        .map((b) => b.textContent)
        .join(" | ")}`,
    )
  }
  return found
}

/**
 * Submits the form the way a person does.
 *
 * `requestSubmit(button)` rather than dispatching a `click` on the button:
 * happy-dom does not translate a submit-button click into a form `submit` event,
 * so a click-based test would report that saving does nothing when the button is
 * perfectly wired. `requestSubmit` also runs constraint validation and picks the
 * submitter, which is the part that matters — a form whose submit handler is only
 * reached for a real submit is exactly the kind of thing this is here to check.
 */
async function submit(button: HTMLElement) {
  const form = button.closest("form")
  if (!form) throw new Error("the save button is not inside a form")

  const requestSubmit = (
    form as unknown as {
      requestSubmit?: (submitter?: unknown) => void
    }
  ).requestSubmit
  if (!requestSubmit) {
    throw new Error(
      "this DOM cannot submit a form, so this test cannot mean anything",
    )
  }

  // Async act, not sync: saving is a promise, and asserting before it settles
  // would report "nothing was sent" for a send that is merely still in flight.
  await act(async () => {
    requestSubmit.call(form, button as unknown)
  })
  // One more turn of the event loop, for the mutation's own state updates, which
  // land after the server call resolves.
  await act(async () => {
    await Promise.resolve()
  })
}

const BLANK: TenantProvider = {
  configured: false,
  base_url: "",
  model: "",
  fingerprint: "",
  max_output_tokens: null,
  temperature: null,
  can_administer: true,
  updated_at: "",
}

describe("saving a provider from an unconfigured workspace", () => {
  beforeEach(() => {
    calls.put = []
    calls.verify = 0
    calls.remove = 0
    stored = { ...BLANK }
    container?.remove()
  })

  it("sends what the person typed", async () => {
    await mount({ ...BLANK })

    type("provider-base-url", "https://api.example.com/v1")
    type("provider-model", "gpt-4o-mini")
    type("provider-api-key", "sk-live-abc123")

    await submit(buttonLabelled("Save provider"))

    expect(calls.put.length).toBe(1)
    expect(calls.put[0]).toEqual({
      data: {
        base_url: "https://api.example.com/v1",
        model: "gpt-4o-mini",
        api_key: "sk-live-abc123",
      },
    })
  })

  it("keeps what the person typed after a successful save", async () => {
    // The symptom being chased. The form's defaults come from the query, so a
    // save that leaves the query reading "not configured" re-seeds the fields to
    // empty — which looks exactly like the save being thrown away.
    await mount({ ...BLANK })

    type("provider-base-url", "https://api.example.com/v1")
    type("provider-model", "gpt-4o-mini")
    type("provider-api-key", "sk-live-abc123")

    await submit(buttonLabelled("Save provider"))

    expect(calls.put.length).toBe(1)
    expect(field("provider-base-url").value).toBe("https://api.example.com/v1")
    expect(field("provider-model").value).toBe("gpt-4o-mini")
  })

  it("sends nothing when the form is blank", async () => {
    // Belt and braces: if validation were the thing stopping the save, this is
    // where it would show, and the answer should be a refusal rather than a PUT.
    await mount({ ...BLANK })

    await submit(buttonLabelled("Save provider"))

    expect(calls.put.length).toBe(0)
  })

  it("refuses a blank key rather than sending one", async () => {
    await mount({ ...BLANK })

    type("provider-base-url", "https://api.example.com/v1")
    type("provider-model", "gpt-4o-mini")
    // Key left empty.

    await submit(buttonLabelled("Save provider"))

    expect(calls.put.length).toBe(0)
  })
})

describe("what a background refetch does to what the person typed", () => {
  beforeEach(() => {
    calls.put = []
    stored = { ...BLANK }
    container?.remove()
  })

  it("does not wipe the form when the query reports nothing configured", async () => {
    // Checked because it is the obvious suspect for the reported symptom — the
    // form's defaults are built from the query, so a refetch returning
    // `configured: false` produces empty defaults. It is not the cause: TanStack
    // Form seeds from `defaultValues` once, and a later change of defaults does
    // not re-seed a form that has been touched.
    //
    // Pinned anyway, because the fix for it — if it ever *is* the cause — would be
    // to seed once and reset explicitly, and that fix depends on this being the
    // current behaviour rather than on an assumption.
    const { queryClient } = await mount({ ...BLANK })

    type("provider-base-url", "https://api.example.com/v1")
    type("provider-model", "gpt-4o-mini")
    type("provider-api-key", "sk-live-abc123")

    await act(async () => {
      queryClient.setQueryData(tenantProviderKeys.detail(), { ...BLANK })
      await queryClient.invalidateQueries({
        queryKey: tenantProviderKeys.detail(),
      })
      await Promise.resolve()
    })

    expect(field("provider-base-url").value).toBe("https://api.example.com/v1")
    expect(field("provider-model").value).toBe("gpt-4o-mini")
    expect(field("provider-api-key").value).toBe("sk-live-abc123")
  })
})
