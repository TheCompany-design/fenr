import { describe, expect, it } from "bun:test"
import type { ReasoningLevel } from "./capabilities"
import {
  levelAt,
  levelIndex,
  levelRatio,
  narrowScale,
  settleLevel,
} from "./effort"

const OPENAI = [
  { id: "none", label: "None" },
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
] satisfies readonly ReasoningLevel[]

/**
 * The one that matters most. Anthropic's scale has no `none`, so it is not a
 * prefix of OpenAI's, and neither is a subset of any other provider's. A scale
 * that happens to line up with a fixed table hides every bug below.
 */
const ANTHROPIC = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
  { id: "max", label: "Max" },
] satisfies readonly ReasoningLevel[]

/** Names and labels that no prettifier could produce from each other. */
const EXOTIC = [
  { id: "minimal", label: "Minimal" },
  { id: "medium_effort", label: "Balanced" },
  { id: "xhigh", label: "Maximum depth" },
  { id: "BALANCED", label: "Balanced" },
] satisfies readonly ReasoningLevel[]

describe("effort vocabulary", () => {
  describe("levelIndex", () => {
    it("ranks by position in the model's own list, not in a table of names", () => {
      // The bug this replaces: a fixed `none…max` order indexed `low` at 1, and
      // the control compared that against this list's index for `low`, which is 0.
      expect(levelIndex(ANTHROPIC, "low")).toBe(0)
      expect(levelIndex(OPENAI, "low")).toBe(1)
      // So the same stored level means different things, and says so.
      expect(levelIndex(OPENAI, "low")).not.toBe(levelIndex(ANTHROPIC, "low"))
    })

    it("reports a level that is not on offer, rather than guessing", () => {
      expect(levelIndex(ANTHROPIC, "none")).toBe(-1)
      expect(levelIndex(OPENAI, "max")).toBe(-1)
      expect(levelIndex(ANTHROPIC, null)).toBe(-1)
    })

    it("finds levels whose names have never been seen before", () => {
      expect(levelIndex(EXOTIC, "xhigh")).toBe(2)
      expect(levelIndex(EXOTIC, "BALANCED")).toBe(3)
    })
  })

  describe("levelAt", () => {
    it("returns the label the provider declared", () => {
      expect(levelAt(EXOTIC, "medium_effort")?.label).toBe("Balanced")
      expect(levelAt(EXOTIC, "xhigh")?.label).toBe("Maximum depth")
    })

    it("returns null for a level that is not on offer", () => {
      expect(levelAt(OPENAI, "max")).toBeNull()
    })
  })

  describe("levelRatio", () => {
    it("puts the last level at the top of the model's own scale", () => {
      // The bug this replaces: dividing by a fixed five made a four-level model
      // reach four fifths of its range, so its top level never got the ceiling.
      expect(levelRatio(ANTHROPIC, "max")).toBe(1)
      expect(levelRatio(OPENAI, "high")).toBe(1)
    })

    it("never gives a level a value of nothing", () => {
      // A budget of zero is not "no reasoning", it is a request the provider
      // rejects, so the scale starts at 1/n rather than 0.
      expect(levelRatio(OPENAI, "none")).toBeCloseTo(0.25, 10)
      expect(levelRatio(ANTHROPIC, "low")).toBeCloseTo(0.25, 10)
    })

    it("spaces the levels evenly and spans the whole range", () => {
      // Evenly means *evenly for this scale*: consecutive levels are one
      // n-th apart and the top one reaches 1. A four-level scale has no single
      // middle element, so the invariant is the spacing rather than a landmark.
      const gaps = OPENAI.map((level, i) =>
        i === 0
          ? null
          : levelRatio(OPENAI, level.id) - levelRatio(OPENAI, OPENAI[i - 1].id),
      ).filter((gap): gap is number => gap !== null)
      expect(new Set(gaps.map((gap) => gap.toFixed(10))).size).toBe(1)
      expect(levelRatio(OPENAI, OPENAI[0].id)).toBeCloseTo(0.25, 10)
      expect(levelRatio(OPENAI, OPENAI[OPENAI.length - 1].id)).toBe(1)
    })

    it("answers zero for a level that is not on offer, and for no scale at all", () => {
      expect(levelRatio(OPENAI, "max")).toBe(0)
      expect(levelRatio([], "low")).toBe(0)
    })
  })

  describe("settleLevel", () => {
    it("keeps a level the new model also offers", () => {
      expect(settleLevel(ANTHROPIC, "high", "high")).toBe("high")
      expect(settleLevel(OPENAI, "none", "medium")).toBe("none")
    })

    it("falls to the model's declared default when the level is not on offer", () => {
      // The bug this replaces: every unrecognised name scored the same distance,
      // so the winner was whichever level happened to be declared first —
      // ignoring the model's own default entirely.
      expect(settleLevel(ANTHROPIC, "none", "high")).toBe("high")
      expect(settleLevel(OPENAI, "max", "medium")).toBe("medium")
    })

    it("has no opinion about which level is 'nearest', because none of it knows", () => {
      // `none` is the bottom of OpenAI's scale and does not exist on Anthropic's.
      // There is no defensible answer that keeps the user at the bottom of a
      // scale they are not on, so it takes the declared default and says so.
      expect(settleLevel(ANTHROPIC, "none", "high")).toBe("high")
    })

    it("uses the declared default when nothing was stored", () => {
      expect(settleLevel(OPENAI, null, "medium")).toBe("medium")
      expect(settleLevel(ANTHROPIC, null, "max")).toBe("max")
    })

    it("falls to the first level only when the default is not on offer either", () => {
      expect(settleLevel(ANTHROPIC, "none", "minimal")).toBe("low")
    })

    it("offers nothing when the model offers nothing", () => {
      expect(settleLevel([], "high", "medium")).toBeNull()
    })
  })

  describe("narrowScale", () => {
    it("keeps the model's order when a key narrows it", () => {
      const narrowed = narrowScale({ levels: OPENAI, default: "medium" }, [
        "high",
        "medium",
      ])
      expect(narrowed.levels.map((level) => level.id)).toEqual([
        "medium",
        "high",
      ])
    })

    it("returns the scale untouched when nothing narrows it", () => {
      const scale = { levels: ANTHROPIC, default: "high" } as const
      expect(narrowScale(scale, undefined)).toBe(scale)
    })

    it("keeps labels through the narrowing", () => {
      const narrowed = narrowScale(
        { levels: EXOTIC, default: "medium_effort" },
        ["xhigh"],
      )
      expect(narrowed.levels).toEqual([{ id: "xhigh", label: "Maximum depth" }])
    })
  })
})
