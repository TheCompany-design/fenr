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

const ANTHROPIC = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
  { id: "max", label: "Max" },
] satisfies readonly ReasoningLevel[]

const SOLO = [
  { id: "balanced", label: "Balanced" },
] satisfies readonly ReasoningLevel[]

const EXOTIC = [
  { id: "minimal", label: "Minimal" },
  { id: "medium_effort", label: "Balanced" },
  { id: "xhigh", label: "Maximum depth" },
  { id: "BALANCED", label: "Balanced" },
] satisfies readonly ReasoningLevel[]

describe("effort vocabulary", () => {
  describe("levelIndex", () => {
    it("ranks by position in the model's own list, not in a table of names", () => {
      expect(levelIndex(ANTHROPIC, "low")).toBe(0)
      expect(levelIndex(OPENAI, "low")).toBe(1)

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
      expect(settleLevel(ANTHROPIC, "none", "high")).toBe("high")
      expect(settleLevel(OPENAI, "max", "medium")).toBe("medium")
    })

    it("has no opinion about which level is 'nearest', because none of it knows", () => {
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
      expect(narrowedDefault(ANTHROPIC)).toBe("low")
      expect(narrowedDefault(OPENAI)).toBe("none")
    })

    it("answers the same as settleLevel, so one model cannot disagree with itself", () => {
      expect(narrowedDefault(ANTHROPIC)).toBe("low")
      expect(settleLevel(ANTHROPIC, "unheard-of", "unheard-of")).toBe("low")
    })

    it("has nothing to offer for an empty scale", () => {
      expect(narrowedDefault([])).toBe("")
    })
  })

  describe("levelPosition", () => {
    it("spans the whole bar, ends included", () => {
      expect(levelPosition(ANTHROPIC, "low")).toBe(0)
      expect(levelPosition(ANTHROPIC, "max")).toBe(1)
    })

    it("is not what a level is worth", () => {
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
