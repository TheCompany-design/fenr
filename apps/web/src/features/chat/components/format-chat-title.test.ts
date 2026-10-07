import { describe, expect, it } from "bun:test"
import type { ChatMessage } from "../types"
import { CHAT_TITLE_MAX_LENGTH, formatChatTitle } from "./format-chat-title"

function message(role: ChatMessage["role"], content: string): ChatMessage {
  return { id: `${role}-1`, role, content }
}

describe("formatChatTitle", () => {
  it("has no title for a clean chat", () => {
    expect(formatChatTitle([])).toBe("")
  })

  it("has no title when the transcript has no user message", () => {
    expect(formatChatTitle([message("agent", "How can I help?")])).toBe("")
  })

  it("survives a missing transcript", () => {
    expect(formatChatTitle(null)).toBe("")
    expect(formatChatTitle(undefined)).toBe("")
  })

  it("has no title for a prompt that is only whitespace", () => {
    expect(formatChatTitle([message("user", "   \n\t  ")])).toBe("")
  })

  it("names a thread after the first prompt, not a later one", () => {
    expect(
      formatChatTitle([
        message("user", "Reconcile the Q3 ledger"),
        message("agent", "On it."),
        message("user", "And summarise it"),
      ]),
    ).toBe("Reconcile the Q3 ledger")
  })

  it("flattens a multi-line prompt onto one line", () => {
    expect(
      formatChatTitle([message("user", "Reconcile   the\n\tledger\r\nplease")]),
    ).toBe("Reconcile the ledger please")
  })

  it("leaves a prompt that already fits alone", () => {
    expect(
      formatChatTitle([message("user", "What is my ledger balance?")]),
    ).toBe("What is my ledger balance?")
  })

  it("cuts a long prompt at a word", () => {
    const prompt = `Reconcile the ${"quarterly ledger "}entries and flag every mismatch`

    const title = formatChatTitle([message("user", prompt)])

    expect(title.endsWith("…")).toBe(true)
    expect(title.length).toBeLessThanOrEqual(CHAT_TITLE_MAX_LENGTH + 1)
    // Never cuts mid-word, and keeps the whole words it does keep.
    expect(title.startsWith("Reconcile the")).toBe(true)
    expect(title).not.toContain("quart…")
  })

  it("clips an unbreakable token rather than dropping most of it", () => {
    // No space exists to cut at, so falling back to a mid-token cut would throw
    // away the entire prefix instead of keeping a usable amount of the URL.
    const url = `https://example.com/${"a".repeat(CHAT_TITLE_MAX_LENGTH * 2)}`

    const title = formatChatTitle([message("user", url)])

    expect(title).toBe(`${url.slice(0, CHAT_TITLE_MAX_LENGTH)}…`)
    expect(title.length).toBe(CHAT_TITLE_MAX_LENGTH + 1)
  })

  it("keeps a single short word that follows a very long one", () => {
    // The last space sits inside the second half of the budget, so cutting
    // there would keep a fragment of nothing.
    const prompt = `${"x".repeat(CHAT_TITLE_MAX_LENGTH)} alpha beta gamma`

    const title = formatChatTitle([message("user", prompt)])

    expect(title).toBe(`${"x".repeat(CHAT_TITLE_MAX_LENGTH)}…`)
  })

  it("clips a long prompt without splitting an emoji", () => {
    // Counting UTF-16 units would cut the ledger emoji in half and leave the
    // header rendering a replacement glyph at the cut.
    const prompt = `Reconcile 🧾 ledger entries for every tenant across the quarter and flag them`

    const title = formatChatTitle([message("user", prompt)])

    expect(title).not.toContain("\ufffd")
    expect(title.endsWith("…")).toBe(true)
    // 48 code points before the ellipsis, same budget as before.
    expect(Array.from(title).length).toBeLessThanOrEqual(
      CHAT_TITLE_MAX_LENGTH + 1,
    )
  })

  it("skips an empty first user message rather than giving up on the title", () => {
    expect(
      formatChatTitle([
        message("user", "   "),
        message("user", "Reconcile the Q3 ledger"),
      ]),
    ).toBe("Reconcile the Q3 ledger")
  })

  it("does not leave a trailing space before the ellipsis", () => {
    const prompt = `Reconcile the ledger ${"entries "}for every tenant`

    const title = formatChatTitle([message("user", prompt)])

    expect(title).not.toMatch(/\s…$/)
  })
})
