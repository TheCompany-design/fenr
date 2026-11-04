import { describe, expect, it } from "bun:test"
import type { ReasoningLevel, ResolvedCaps } from "./capabilities"
import type { Mention } from "./reconcile"
import { type ComposerState, reanchorMentions, reconcile } from "./reconcile"

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

describe("reanchorMentions", () => {
  const MENTION: Mention = {
    id: "m1",
    kind: "app",
    label: "GitHub",
    insertText: "@GitHub",
    start: 17,
    end: 24,
    toolkitSlug: "github",
  }
  const DRAFT = "file an issue on @GitHub"

  function mentions(...overrides: Partial<Mention>[]): Mention[] {
    return overrides.length > 0
      ? overrides.map((override) => ({ ...MENTION, ...override }))
      : [MENTION]
  }

  it("keeps a mention that an edit merely shifts", () => {
    const next = "please file an issue on @GitHub"
    expect(reanchorMentions(DRAFT, next, mentions())).toEqual([
      { ...MENTION, start: 24, end: 31 },
    ])
  })

  it("keeps it when the edit only deletes text before it", () => {
    const next = "file an issue on @GitHub".slice(1)
    expect(reanchorMentions(DRAFT, next, mentions())).toEqual([
      { ...MENTION, start: 16, end: 23 },
    ])
  })

  it("drops a mention whose own text was edited", () => {
    const next = "file an issue on @GitHu"
    expect(reanchorMentions(DRAFT, next, mentions())).toEqual([])
  })

  it("treats an insertion inside the span as an edit of the mention", () => {
    const next = "file an issue on @XGitHub"
    expect(reanchorMentions(DRAFT, next, mentions())).toEqual([])
  })

  it("treats an insertion at the span's start as belonging before it", () => {
    const next = "file an issue on x@GitHub"
    expect(reanchorMentions(DRAFT, next, mentions())).toEqual([
      { ...MENTION, start: 18, end: 25 },
    ])
  })

  it("treats an insertion at the span's end as belonging after it", () => {
    const next = "file an issue on @GitHubx"
    expect(reanchorMentions(DRAFT, next, mentions())).toEqual([
      { ...MENTION, start: 17, end: 24 },
    ])
  })

  it("re-anchors each mention around an edit between them", () => {
    const first = {
      ...MENTION,
      id: "a",
      insertText: "@Slack",
      start: 0,
      end: 6,
    }
    const second = { ...MENTION, id: "b", start: 12, end: 19 }
    const previous = "@Slack then @GitHub"
    const next = "@Slack or @GitHub"

    expect(reanchorMentions(previous, next, [first, second])).toEqual([
      first,
      { ...second, start: 10, end: 17 },
    ])
  })

  it("keeps a mention when a replacement ends right at its start", () => {
    const next = "file an issue o@GitHub"
    expect(reanchorMentions(DRAFT, next, mentions())).toEqual([
      { ...MENTION, start: 15, end: 22 },
    ])
  })

  it("drops a replacement that reaches into the span", () => {
    const next = "file an issue on xub"
    expect(reanchorMentions(DRAFT, next, mentions())).toEqual([])
  })

  it("self-heals a span that no longer names its mention", () => {
    const stale = { ...MENTION, start: 0, end: 7 }
    expect(reanchorMentions(DRAFT, DRAFT, [stale])).toEqual([])
  })

  it("answers empty when there is nothing to anchor", () => {
    expect(reanchorMentions(DRAFT, "new draft", [])).toEqual([])
  })
})
