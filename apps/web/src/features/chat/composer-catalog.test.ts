import { describe, expect, it } from "bun:test"
import { resolveCapabilities } from "@/components/composer"
import type { Attachment } from "@/components/composer/catalog/attachments"
import type { ModelSpec } from "@/components/composer/catalog/capabilities"
import { reconcile } from "@/components/composer/catalog/reconcile"
import { measureContext } from "@/components/composer/catalog/usage"
import { providerDisplayName } from "@/components/providers/provider-identity"
import type { ListedModel, TenantProviderList } from "@/lib/schemas/nabu"
import {
  flattenPrompt,
  isTextLike,
  loadSavedCatalogue,
  MAX_PROMPT_BYTES,
  orderProviders,
  toCatalogModel,
  toComposerProvider,
  toRuntimeTools,
} from "./composer-catalog"

function config(overrides: Partial<TenantProviderList["providers"][number]>) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    provider: "openai",
    model: "gpt-test",
    label: null,
    is_default: false,
    fingerprint: "a1b2c3",
    max_output_tokens: null,
    temperature: null,
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  }
}

/** A catalogue fetch that always answers with this fixture. */
function catalogueWith(models: ListedModel[]) {
  return { ok: true as const, models }
}

const GPT: ListedModel = {
  id: "gpt-5.2",
  display_name: "GPT-5.2",
  context_window: 400_000,
  max_output_tokens: 128_000,
  accepts_images: true,
  pricing: { input_usd: 1.25, output_usd: 10 },
}

function attachment(overrides: Partial<Attachment> = {}): Attachment {
  return {
    id: "att_1",
    name: "notes.txt",
    size: 120,
    mimeType: "text/plain",
    ...overrides,
  }
}

describe("saved providers as the composer's catalog", () => {
  it("orders the workspace default first so auto-selection lands on it", () => {
    const list = {
      providers: [
        config({
          id: "b",
          is_default: false,
          updated_at: "2026-01-02T00:00:00Z",
        }),
        config({
          id: "a",
          is_default: true,
          updated_at: "2026-01-03T00:00:00Z",
        }),
        config({
          id: "c",
          is_default: false,
          updated_at: "2026-01-01T00:00:00Z",
        }),
      ],
      can_administer: true,
    }
    const ordered = orderProviders(list, async () => catalogueWith([]))
    expect(ordered.map((provider) => provider.id)).toEqual(["a", "c", "b"])
  })

  it("names an unlabelled entry after its vendor", () => {
    expect(providerDisplayName("google")).toBe("Google Gemini")
    expect(providerDisplayName("mistral")).toBe("mistral")
  })

  it("exposes the vendor's whole catalogue for a saved configuration", async () => {
    const provider = toComposerProvider(config({}), async () =>
      catalogueWith([GPT, { id: "gpt-5.2-mini" }]),
    )
    const models = await provider.source.load(null)
    expect(models.map((model) => model.id)).toEqual(["gpt-5.2", "gpt-5.2-mini"])
    // The vendor's name where it published one, the id where it did not.
    expect(models[0]?.name).toBe("GPT-5.2")
    expect(models[1]?.name).toBe("gpt-5.2-mini")
  })

  it("carries what the vendor said about a model into the picker", () => {
    const spec = toCatalogModel(GPT, "config-1")
    expect(spec.limits.contextWindow).toBe(400_000)
    expect(spec.limits.maxOutput).toBe(128_000)
    expect(spec.cost).toEqual({ inputPerMTok: 1.25, outputPerMTok: 10 })
    expect(spec.caps.vision.supported).toBe(true)
    // What the vendor did not say reads as the runtime's honest fallback, not
    // as zero and not as an invented window.
    const sparse = toCatalogModel({ id: "m" }, "config-1")
    expect(sparse.limits.contextWindow).toBe(32_000)
    expect(sparse.limits.maxOutput).toBe(4_096)
    expect(sparse.caps.vision.supported).toBe(false)
  })

  it("lands a declined credential in the catalog's failed state, in the vendor's words", async () => {
    const refused = async () => ({
      ok: false as const,
      message: "the provider did not accept the stored credential",
    })
    await expect(loadSavedCatalogue(refused, "config-1")).rejects.toThrow(
      /did not accept the stored credential/,
    )
  })

  it("keeps a vendor that published no models an empty answer, not a failure", async () => {
    const models = await loadSavedCatalogue(
      async () => catalogueWith([]),
      "config-1",
    )
    expect(models).toEqual([])
  })
})

describe("attachment flattening", () => {
  it("appends text files under a named fence", async () => {
    const file = new File(["hello world"], "notes.txt", { type: "text/plain" })
    const prompt = await flattenPrompt("Summarize this", [
      attachment({ file, size: file.size }),
    ])
    expect(prompt).toContain("Summarize this")
    expect(prompt).toContain("--- attached file: notes.txt ---")
    expect(prompt).toContain("hello world")
  })

  it("leaves the prompt alone when nothing is attached", async () => {
    expect(await flattenPrompt("Just text", [])).toBe("Just text")
  })

  it("refuses to send past the runtime's prompt cap rather than trimming", async () => {
    const big = new File(["x".repeat(MAX_PROMPT_BYTES)], "big.txt", {
      type: "text/plain",
    })
    await expect(
      flattenPrompt("hello", [attachment({ file: big, name: "big.txt" })]),
    ).rejects.toThrow(/accepts 64 KB/)
  })

  it("classifies mime types the same way reconcile does", () => {
    expect(isTextLike("text/plain")).toBe(true)
    expect(isTextLike("application/json")).toBe(true)
    expect(isTextLike("image/png")).toBe(false)
    expect(isTextLike("application/pdf")).toBe(false)
  })
})

describe("runtime tools render as managed, not toggled", () => {
  it("names known tools and falls back to the raw id", () => {
    const tools = toRuntimeTools(["web_search", "echo", "future_tool"])
    expect(tools[0]?.label).toBe("Web search")
    expect(tools[1]?.label).toBe("Echo")
    expect(tools[2]?.label).toBe("future_tool")
  })
})

describe("the context meter seeds from real usage", () => {
  const provider = toComposerProvider(config({}), async () =>
    catalogueWith([GPT]),
  )
  const load = provider.source.load
  let model: ModelSpec | null = null

  it("resolves caps through the saved provider's catalog", async () => {
    const models = await load(null)
    model = models[0] ?? null
    expect(model).not.toBeNull()
  })

  function resolved() {
    return resolveCapabilities({
      provider,
      model,
      connection: { state: "ready", validatedAt: 0 },
      entitlements: {},
    })
  }

  it("counts a seed in place of the covered messages", () => {
    const caps = resolved()
    // 1,000 tokens the provider reported for the last request.
    const seeded = measureContext({
      caps,
      systemPrompt: "",
      messages: [],
      draft: "",
      historySeed: 1_000,
    })
    // The fallback system prompt is estimated out of the seed, not added on
    // top of it: the provider already counted the real system prompt.
    const fallback = measureContext({
      caps,
      systemPrompt: "",
      messages: [],
      draft: "",
    })
    expect(seeded.breakdown.history).toBe(1_000 - fallback.breakdown.system)
    expect(seeded.used).toBe(1_000)
  })

  it("estimates only what arrived after the seeded turn", () => {
    const caps = resolved()
    const usage = measureContext({
      caps,
      systemPrompt: "",
      messages: [{ content: "x".repeat(400) }], // ~100 tokens + 4 framing
      draft: "",
      historySeed: 1_000,
    })
    expect(usage.breakdown.history).toBe(1_104)
  })

  it("estimates the whole transcript when no seed exists", () => {
    const caps = resolved()
    const usage = measureContext({
      caps,
      systemPrompt: "",
      messages: [{ content: "x".repeat(400) }, { content: "y".repeat(400) }],
      draft: "",
    })
    expect(usage.breakdown.history).toBe(100 + 100 + 4 + 4)
  })
})

describe("file rules block content instead of dropping it", () => {
  let model: ModelSpec | null = null
  const provider = toComposerProvider(config({}), async () =>
    catalogueWith([GPT]),
  )

  it("rejects a mime type the model cannot accept, by name", async () => {
    const models = await provider.source.load(null)
    model = models[0] ?? null
    const caps = resolveCapabilities({
      provider,
      model,
      connection: { state: "ready", validatedAt: 0 },
      entitlements: {},
    })
    const result = reconcile(
      {
        text: "",
        mentions: [],
        attachments: [attachment({ mimeType: "image/png", name: "shot.png" })],
        selection: { providerId: provider.id, modelId: model?.id ?? "" },
        effort: null,
        toolIds: [],
        search: false,
      },
      caps,
    )
    const files = result.blockers.find((blocker) => blocker.kind === "files")
    expect(files).toBeDefined()
    if (files?.kind === "files") {
      expect(files.rejected[0]?.name).toBe("shot.png")
    }
  })

  it("rejects an oversized file with a human reason", async () => {
    const caps = resolveCapabilities({
      provider,
      model,
      connection: { state: "ready", validatedAt: 0 },
      entitlements: {},
    })
    const result = reconcile(
      {
        text: "",
        mentions: [],
        attachments: [attachment({ size: 5 * 1024 * 1024 })],
        selection: { providerId: provider.id, modelId: model?.id ?? "" },
        effort: null,
        toolIds: [],
        search: false,
      },
      caps,
    )
    const files = result.blockers.find((blocker) => blocker.kind === "files")
    expect(files).toBeDefined()
    if (files?.kind === "files") {
      expect(files.rejected[0]?.reason).toContain("larger than")
    }
  })

  it("accepts a text file that fits", async () => {
    const caps = resolveCapabilities({
      provider,
      model,
      connection: { state: "ready", validatedAt: 0 },
      entitlements: {},
    })
    const result = reconcile(
      {
        text: "",
        mentions: [],
        attachments: [attachment({})],
        selection: { providerId: provider.id, modelId: model?.id ?? "" },
        effort: null,
        toolIds: [],
        search: false,
      },
      caps,
    )
    expect(
      result.blockers.find((blocker) => blocker.kind === "files"),
    ).toBeUndefined()
  })
})
