import { describe, expect, it } from "bun:test"
import type { Mention } from "../catalog/reconcile"
import { buildMentionSegments } from "./prompt-mention-layer"

function appMention(overrides: Partial<Mention> = {}): Mention {
  return {
    id: "m1",
    kind: "app",
    label: "Slack",
    insertText: "@Slack",
    start: 4,
    end: 10,
    toolkitSlug: "slack",
    ...overrides,
  }
}

describe("buildMentionSegments", () => {
  it("returns one plain-text segment when nothing is mentioned", () => {
    expect(buildMentionSegments("just a draft", [])).toEqual([
      { kind: "text", start: 0, text: "just a draft" },
    ])
  })

  it("splits the draft around an app mention", () => {
    const mention = appMention()
    const segments = buildMentionSegments("ask @Slack now", [mention])

    expect(segments).toEqual([
      { kind: "text", start: 0, text: "ask " },
      { kind: "mention", start: 4, text: "@Slack", mention },
      { kind: "text", start: 10, text: " now" },
    ])
  })

  it("keeps non-app mentions as plain text", () => {
    const file = appMention({
      id: "m2",
      kind: "file",
      toolkitSlug: undefined,
    })
    expect(buildMentionSegments("ask @notes.txt", [file])).toEqual([
      { kind: "text", start: 0, text: "ask @notes.txt" },
    ])
  })

  it("draws mentions at the very start and very end", () => {
    const first = appMention({ id: "a", start: 0, end: 6 })
    const last = appMention({ id: "b", start: 11, end: 17 })
    const segments = buildMentionSegments("@Slack and @Slack", [first, last])

    expect(segments).toEqual([
      { kind: "mention", start: 0, text: "@Slack", mention: first },
      { kind: "text", start: 6, text: " and " },
      { kind: "mention", start: 11, text: "@Slack", mention: last },
    ])
  })

  it("skips a mention that overlaps the one before it", () => {
    const first = appMention({ id: "a", start: 0, end: 6 })
    const overlapping = appMention({ id: "b", start: 3, end: 12 })
    const segments = buildMentionSegments("@Slack @Notion", [
      first,
      overlapping,
    ])

    expect(segments).toEqual([
      { kind: "mention", start: 0, text: "@Slack", mention: first },
      { kind: "text", start: 6, text: " @Notion" },
    ])
  })

  it("skips spans that are empty, reversed, or outside the value", () => {
    const empty = appMention({ id: "a", start: 2, end: 2 })
    const reversed = appMention({ id: "b", start: 8, end: 4 })
    const beyond = appMention({ id: "c", start: 50, end: 60 })
    expect(
      buildMentionSegments("plain draft", [empty, reversed, beyond]),
    ).toEqual([{ kind: "text", start: 0, text: "plain draft" }])
  })

  it("clamps a span that runs past the end of the value", () => {
    const stale = appMention({ start: 0, end: 6 })
    const segments = buildMentionSegments("@Sl", [stale])
    expect(segments).toEqual([
      { kind: "mention", start: 0, text: "@Sl", mention: stale },
    ])
  })

  it("carries the brand data through on the mention segment", () => {
    const mention = appMention({
      start: 0,
      end: 6,
      logoUrl: "https://example.test/slack.svg",
      logoMonochrome: false,
      accentHex: "#4a154b",
    })
    const segments = buildMentionSegments("@Slack", [mention])

    expect(segments).toEqual([
      { kind: "mention", start: 0, text: "@Slack", mention },
    ])
  })
})
