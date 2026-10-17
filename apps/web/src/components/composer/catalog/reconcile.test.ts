import { describe, expect, it } from "bun:test"
import type { ReasoningLevel, ResolvedCaps } from "./capabilities"
import { type ComposerState, reconcile } from "./reconcile"

/**
 * Effort is a *setting*, so switching models adjusts it and says so — it is
 * never silently left invalid and never silently raised.
 *
 * These cases exist because `settleLevel` is proven in isolation in
 * `effort.test.ts`, and nothing proved that `reconcile` actually calls it, or
 * what happens on the branch where reasoning disappears entirely.
 */

/** Anthropic: four levels, no `none`. `high` is its declared default. */
const ANTHROPIC = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
  { id: "max", label: "Max" },
] satisfies readonly ReasoningLevel[]

/** OpenAI: four levels, `medium` by default. Neither list is a prefix of the
 *  other, which is the whole reason the reconciler cannot rank names. */
const OPENAI = [
  { id: "none", label: "None" },
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
] satisfies readonly ReasoningLevel[]

/** Nothing offered, so a capability under no test cannot mask one. */
const NOTHING = {
  access: { kind: "denied" as const, reason: "n/a" },
  capability: null,
}

/**
 * A complete `ResolvedCaps`, because `reconcile` reads six of its capabilities
 * and a partial fixture fails on the ones it does not care about rather than on
 * the one under test.
 */
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
    // Nothing changed, so nothing is said: a notice for an unchanged setting is
    // noise, and the feedback surface is already busy.
    expect(result.notices).toEqual([])
  })

  it("settles a level from another model's scale onto this one's default", () => {
    // `none` exists on OpenAI's scale and not on Anthropic's.
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
    // Both models offer `medium`, so this is the *only* level that can carry
    // over; the failure this guards is picking `levels[0]` because an unknown
    // name scored the same distance as every other one.
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
    // Downgrading deliberately must not be punished by blocking the send, and
    // must not leave a level the model cannot take sitting in the store.
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
        // A sentinel the catalogue cannot contain, so a `null` fails here rather
        // than being quietly accepted as "not in the list".
        const ids = levels.map((level) => level.id)
        expect(ids).toContain(result.state.effort ?? "__settled_to_nothing__")
      }
    }
  })
})
