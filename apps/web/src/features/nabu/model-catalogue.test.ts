import { describe, expect, it } from "bun:test"

import type { ListedModel } from "@/lib/schemas/nabu"
import {
  formatPrice,
  formatTokenCount,
  modelFacts,
  modelIdSuffix,
  modelName,
  storefrontWarning,
} from "./model-catalogue"

function listed(model: ListedModel): ListedModel {
  return model
}

describe("modelName", () => {
  it("prefers the vendor's own name", () => {
    expect(
      modelName(
        listed({
          id: "anthropic/claude-sonnet-5",
          display_name: "Anthropic: Claude Sonnet 5",
        }),
      ),
    ).toBe("Anthropic: Claude Sonnet 5")
  })

  it("falls back to the id when the vendor published no name", () => {
    expect(modelName(listed({ id: "gpt-4o" }))).toBe("gpt-4o")
  })

  it("does not repeat a name that is only the id", () => {
    expect(modelName(listed({ id: "gpt-4o", display_name: "gpt-4o" }))).toBe(
      "gpt-4o",
    )
    expect(
      modelIdSuffix(listed({ id: "gpt-4o", display_name: "gpt-4o" })),
    ).toBe("")
  })

  it("keeps the id visible beside a name, so it is never hidden", () => {
    const model = listed({
      id: "anthropic/claude-sonnet-5",
      display_name: "Anthropic: Claude Sonnet 5",
    })
    expect(modelName(model)).not.toBe(model.id)
    expect(modelIdSuffix(model)).toBe("anthropic/claude-sonnet-5")
  })

  it("treats a blank name as no name", () => {
    expect(modelName(listed({ id: "gpt-4o", display_name: "   " }))).toBe(
      "gpt-4o",
    )
  })
})

describe("formatTokenCount", () => {
  it("reads a window at the precision a person wants", () => {
    expect(formatTokenCount(1_048_576)).toBe("1M")
    expect(formatTokenCount(1_000_000)).toBe("1M")
    expect(formatTokenCount(2_000_000)).toBe("2M")
    expect(formatTokenCount(1_500_000)).toBe("1.5M")
    expect(formatTokenCount(128_000)).toBe("128k")
    expect(formatTokenCount(200_000)).toBe("200k")
    expect(formatTokenCount(64_000)).toBe("64k")
    expect(formatTokenCount(999)).toBe("999")
  })

  it("says nothing about a count that is not one", () => {
    expect(formatTokenCount(0)).toBe("")
    expect(formatTokenCount(-1)).toBe("")
    expect(formatTokenCount(Number.NaN)).toBe("")
  })
})

describe("formatPrice", () => {
  it("keeps two decimals where they are enough", () => {
    expect(formatPrice(2.5)).toBe("$2.50")
    expect(formatPrice(15)).toBe("$15.00")
    expect(formatPrice(0)).toBe("$0.00")
  })

  it("does not round a cheap model to zero", () => {
    expect(formatPrice(0.0004)).toBe("$0.0004")
    expect(formatPrice(0.01)).toBe("$0.01")
  })

  it("says nothing about a price that is not one", () => {
    expect(formatPrice(-1)).toBe("")
    expect(formatPrice(Number.NaN)).toBe("")
  })

  it("does not render a price nobody could have meant in exponential", () => {
    expect(formatPrice(1e300)).toBe("$1000+")
    expect(formatPrice(1e21)).toBe("$1000+")
    expect(formatPrice(999.99)).toBe("$999.99")
  })
})

describe("modelFacts", () => {
  it("states the facts a row carries, and only those", () => {
    expect(
      modelFacts(
        listed({
          id: "anthropic/claude-sonnet-5",
          context_window: 1_000_000,
          max_output_tokens: 128_000,
          accepts_images: true,
          pricing: { input_usd: 3, output_usd: 15 },
        }),
      ),
    ).toBe("1M context · $3.00 / $15.00 per M tokens · images")
  })

  it("leaves the output ceiling off the row on purpose", () => {
    expect(
      modelFacts(
        listed({
          id: "a",
          context_window: 200_000,
          max_output_tokens: 128_000,
        }),
      ),
    ).toBe("200k context")
  })

  it("renders a model the vendor described only by name with no detail line", () => {
    expect(modelFacts(listed({ id: "gpt-4o" }))).toBe("")
    expect(
      modelFacts(
        listed({ id: "claude-opus-4-8", display_name: "Claude Opus 4.8" }),
      ),
    ).toBe("")
  })

  it("omits any single fact the vendor left out", () => {
    expect(modelFacts(listed({ id: "a", context_window: 200_000 }))).toBe(
      "200k context",
    )
    expect(
      modelFacts(
        listed({ id: "a", pricing: { input_usd: 0.15, output_usd: 0.6 } }),
      ),
    ).toBe("$0.15 / $0.60 per M tokens")
  })

  it("does not claim image input from a vendor that published no modalities", () => {
    expect(
      modelFacts(
        listed({ id: "a", accepts_images: false, context_window: 8_192 }),
      ),
    ).toBe("8k context")
  })
})

describe("storefrontWarning", () => {
  it("names a model the vendor's storefront no longer carries", () => {
    expect(
      storefrontWarning(
        listed({
          id: "nvidia/gpt-oss-120b",
          storefront: { published: false },
        }),
      ),
    ).toBe("No longer on the vendor's storefront")
  })

  it("names a model the vendor lists but is not currently serving", () => {
    expect(
      storefrontWarning(
        listed({
          id: "stepfun-ai/step-5-preview",
          storefront: { published: true, serving: false },
        }),
      ),
    ).toBe("Listed by the vendor, but not currently serving")
  })

  it("names the day the vendor says the model ends", () => {
    expect(
      storefrontWarning(
        listed({
          id: "nvidia/nemotron-3-super-120b-a12b",
          storefront: { published: true, ends_on: "2026-10-19" },
        }),
      ),
    ).toBe("The vendor retires it on Oct 19, 2026")
  })

  it("says nothing for a model the vendor published quietly", () => {
    expect(
      storefrontWarning(
        listed({
          id: "nvidia/gpt-oss-20b",
          storefront: { published: true },
        }),
      ),
    ).toBe("")
  })

  it("says nothing when the runtime could not answer", () => {
    expect(storefrontWarning(listed({ id: "nvidia/gpt-oss-20b" }))).toBe("")
  })
})
