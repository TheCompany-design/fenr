import { describe, expect, it } from "bun:test"
import type { ReasoningLevel } from "./capabilities"
import {
  levelAt,
  levelIndex,
  levelPosition,
  narrowedDefault,
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

/** A single level, to prove the degenerate cases stay renderable. */
const SOLO = [
  { id: "balanced", label: "Balanced" },
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

  describe("narrowedDefault", () => {
    it("falls back to the lowest level the model offers", () => {
      // Never the highest: a key that cannot reach the setting a model asks for
      // must not be promoted to running at its maximum instead.
      expect(narrowedDefault(ANTHROPIC)).toBe("low")
      expect(narrowedDefault(OPENAI)).toBe("none")
    })

    it("answers the same as settleLevel, so one model cannot disagree with itself", () => {
      // These two used to disagree — one fell back to the first level, the other
      // to the last — so the same key got a different answer depending on which
      // path asked.
      expect(narrowedDefault(ANTHROPIC)).toBe("low")
      expect(settleLevel(ANTHROPIC, "unheard-of", "unheard-of")).toBe("low")
    })

    it("has nothing to offer for an empty scale", () => {
      expect(narrowedDefault([])).toBe("")
    })
  })

  describe("levelPosition", () => {
    it("spans the whole bar, ends included", () => {
      // The knob's travel is inset by half its own width, so a mark at the
      // track's very end would be a position no setting could occupy.
      expect(levelPosition(ANTHROPIC, "low")).toBe(0)
      expect(levelPosition(ANTHROPIC, "max")).toBe(1)
    })

    it("is not what a level is worth", () => {
      // The first level belongs at the left end of the bar: placing its mark
      // anywhere else would leave a stretch of track no level can claim.
      expect(levelPosition(ANTHROPIC, "low")).toBe(0)
    })

    it("centres a one-level scale rather than dividing by nothing", () => {
      expect(levelPosition(SOLO, "balanced")).toBe(0.5)
      expect(levelPosition([], "anything")).toBe(0)
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
