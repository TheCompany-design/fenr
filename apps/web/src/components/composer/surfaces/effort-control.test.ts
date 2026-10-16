import { describe, expect, it } from "bun:test"
import type { EffortEncoding, ReasoningLevel } from "../catalog/capabilities"
import { encodeEffort } from "./effort-control"

const ANTHROPIC = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
  { id: "max", label: "Max" },
] satisfies readonly ReasoningLevel[]

const BUDGET: EffortEncoding = {
  style: "budget",
  field: "thinking.budget_tokens",
  max: 32_000,
  unit: "tokens",
}

/**
 * The wire boundary is the only place the composer's scale meets a provider's
 * units, so it is the only place a budget can be right or wrong. The tests below
 * are all variations on one question: does this model get the whole range it is
 * entitled to?
 */
describe("encodeEffort", () => {
  it("gives the top level the whole ceiling on a four-level scale", () => {
    expect(encodeEffort("max", BUDGET, ANTHROPIC)).toEqual({
      "thinking.budget_tokens": 32_000,
    })
  })

  it("gives the top level the whole ceiling on a five-level scale too", () => {
    const five = [
      { id: "none", label: "None" },
      { id: "low", label: "Low" },
      { id: "medium", label: "Medium" },
      { id: "high", label: "High" },
      { id: "max", label: "Max" },
    ] satisfies readonly ReasoningLevel[]
    expect(encodeEffort("max", BUDGET, five)).toEqual({
      "thinking.budget_tokens": 32_000,
    })
  })

  it("scales the budget to the model rather than to the level's name", () => {
    // `high` is 3rd of 4 on this scale and 4th of 5 on OpenAI's, so the same
    // name must not buy the same budget just because it matches.
    expect(encodeEffort("high", BUDGET, ANTHROPIC)).toEqual({
      "thinking.budget_tokens": 24_000,
    })
    const five = [
      { id: "none", label: "None" },
      { id: "low", label: "Low" },
      { id: "medium", label: "Medium" },
      { id: "high", label: "High" },
      { id: "max", label: "Max" },
    ] satisfies readonly ReasoningLevel[]
    expect(encodeEffort("high", BUDGET, five)).toEqual({
      "thinking.budget_tokens": 25_600,
    })
  })

  it("never sends a budget of nothing", () => {
    // Zero is not "no reasoning", it is a request the provider rejects.
    expect(encodeEffort("low", BUDGET, ANTHROPIC)).toEqual({
      "thinking.budget_tokens": 8_000,
    })
  })

  it("sends a level it has never heard of, verbatim", () => {
    const enumStyle: EffortEncoding = {
      style: "enum",
      field: "reasoning_effort",
    }
    expect(
      encodeEffort("xhigh", enumStyle, [
        { id: "xhigh", label: "Maximum depth" },
      ]),
    ).toEqual({ reasoning_effort: "xhigh" })
  })

  it("sends nothing when the provider has no wire form for effort", () => {
    expect(encodeEffort("high", { style: "none" }, ANTHROPIC)).toEqual({})
  })

  it("sends nothing when no level is chosen", () => {
    expect(encodeEffort(null, BUDGET, ANTHROPIC)).toEqual({})
  })

  it("sends nothing for a level this model does not offer", () => {
    // The failure differs by encoding and only one of them is loud: a budget
    // would be `0` — the one value a provider rejects outright — and an enum
    // would forward a name the provider has never heard of. The store's
    // reconciler keeps the stored level on offer, so this is the boundary
    // holding for a payload captured across a change of model.
    expect(encodeEffort("none", BUDGET, ANTHROPIC)).toEqual({})
    expect(
      encodeEffort("none", { style: "enum", field: "e" }, ANTHROPIC),
    ).toEqual({})
    expect(
      encodeEffort("total_madness", { style: "level", field: "e" }, ANTHROPIC),
    ).toEqual({})
  })

  it("still sends a level it has never heard of, when the model offers it", () => {
    // The guard is "not on *this* model's list", not "is one we recognise" —
    // otherwise the refactor would have re-introduced the closed vocabulary it
    // exists to remove.
    const exotic = [
      { id: "minimal", label: "Minimal" },
      { id: "xhigh", label: "Maximum depth" },
    ] satisfies readonly ReasoningLevel[]
    const enumStyle: EffortEncoding = {
      style: "enum",
      field: "reasoning_effort",
    }
    expect(encodeEffort("minimal", enumStyle, exotic)).toEqual({
      reasoning_effort: "minimal",
    })
    expect(encodeEffort("xhigh", enumStyle, exotic)).toEqual({
      reasoning_effort: "xhigh",
    })
  })

  it("upper-cases only for the encoding that asks for it", () => {
    const upper: EffortEncoding = { style: "level", field: "reasoning_level" }
    expect(encodeEffort("high", upper, ANTHROPIC)).toEqual({
      reasoning_level: "HIGH",
    })
    const lower: EffortEncoding = { style: "enum", field: "reasoning_effort" }
    expect(encodeEffort("high", lower, ANTHROPIC)).toEqual({
      reasoning_effort: "high",
    })
  })
})
