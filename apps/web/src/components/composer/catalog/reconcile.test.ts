import { describe, expect, it } from "bun:test"
import type { ReasoningLevel, ResolvedCaps } from "./capabilities"
import { type ComposerState, reconcile } from "./reconcile"

const ANTHROPIC = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
  { id: "max", label: "Max" },
] satisfies readonly ReasoningLevel[]

const OPENAI = [
  { id: "none", label: "None" },
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
] satisfies readonly ReasoningLevel[]

const NOTHING = {
  access: { kind: "denied" as const, reason: "n/a" },
  capability: null,
}

function capsWith(reasoning: ResolvedCaps["reasoning"]): ResolvedCaps {
  return {
    model: { id: "m" },
    modelAccess: { kind: "available" },
    reasoning,
    vision: NOTHING,
    files: NOTHING,
    tools: NOTHING,
    native: NOTHING,
    search: NOTHING,
  } as unknown as ResolvedCaps
}

function offered(
  levels: readonly ReasoningLevel[],
  defaultId: string,
): ResolvedCaps["reasoning"] {
  return {
    access: { kind: "available" },
    capability: {
      levels,
      default: defaultId,
    },
  }
}

const NO_REASONING: ResolvedCaps["reasoning"] = {
  access: { kind: "denied", reason: "Not supported by this model" },
  capability: null,
}

const GATED_REASONING: ResolvedCaps["reasoning"] = {
  access: {
    kind: "gated",
    gate: { kind: "upgrade", plan: "p", label: "Your key's tier" },
  },
  capability: null,
}

function state(effort: string | null): ComposerState {
  return {
    text: "",
    mentions: [],
    attachments: [],
    selection: { providerId: "anthropic", modelId: "m" },
    effort,
    toolIds: [],
    search: false,
  }
}

describe("reconcile: effort", () => {
  it("keeps a level the new model also offers, without reporting anything", () => {
    const result = reconcile(
      state("high"),
      capsWith(offered(ANTHROPIC, "high")),
    )
    expect(result.state.effort).toBe("high")

    expect(result.notices).toEqual([])
  })

  it("settles a level from another model's scale onto this one's default", () => {
    const result = reconcile(
      state("none"),
      capsWith(offered(ANTHROPIC, "high")),
    )
    expect(result.state.effort).toBe("high")
    expect(result.notices).toEqual([
      { kind: "effort-clamped", from: "none", to: "high" },
    ])
  })

  it("takes the model's declared default rather than an arbitrary one", () => {
    expect(
      reconcile(state("medium"), capsWith(offered(ANTHROPIC, "high"))).state
        .effort,
    ).toBe("medium")
    expect(
      reconcile(state("medium"), capsWith(offered(OPENAI, "medium"))).state
        .effort,
    ).toBe("medium")
  })

  it("adopts the declared default when nothing was chosen", () => {
    const result = reconcile(state(null), capsWith(offered(ANTHROPIC, "high")))
    expect(result.state.effort).toBe("high")
    expect(result.notices).toEqual([])
  })

  it("drops the level, and says so, when reasoning disappears", () => {
    for (const caps of [NO_REASONING, GATED_REASONING]) {
      const result = reconcile(state("high"), capsWith(caps))
      expect(result.state.effort).toBeNull()
      expect(result.notices).toContainEqual({ kind: "effort-dropped" })
    }
  })

  it("never leaves the store holding a level the model does not offer", () => {
    for (const levels of [ANTHROPIC, OPENAI]) {
      for (const requested of [null, "none", "low", "high", "max", "unknown"]) {
        const result = reconcile(
          state(requested),
          capsWith(offered(levels, "high")),
        )

        const ids = levels.map((level) => level.id)
        expect(ids).toContain(result.state.effort ?? "__settled_to_nothing__")
      }
    }
  })
})
