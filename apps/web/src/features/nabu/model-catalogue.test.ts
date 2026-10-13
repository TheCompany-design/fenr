/**
 * The picker renders exactly what a vendor published and nothing more, so these
 * formatters carry the whole burden of turning an absence into something a
 * person can read. The cases below are the ones that would be quietly wrong: a
 * missing fact rendered as a zero, a cheap model rounded to free, and a name
 * that hides the id someone would have to type.
 */
import { describe, expect, it } from "bun:test"

import type { ListedModel } from "@/lib/schemas/nabu"
import {
  formatPrice,
  formatTokenCount,
  modelFacts,
  modelIdSuffix,
  modelName,
} from "./model-catalogue"

/** A model carrying only what the test says the vendor published. */
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
    // A per-million price of $0.0004 displayed as "$0.00" would read as free.
    expect(formatPrice(0.0004)).toBe("$0.0004")
    expect(formatPrice(0.01)).toBe("$0.01")
  })

  it("says nothing about a price that is not one", () => {
    expect(formatPrice(-1)).toBe("")
    expect(formatPrice(Number.NaN)).toBe("")
  })
})

describe("modelFacts", () => {
  it("states every fact the vendor published, and only those", () => {
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

  it("renders a model the vendor described only by name with no detail line", () => {
    // The absence is the signal: a row of dashes would imply facts nobody gave.
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
