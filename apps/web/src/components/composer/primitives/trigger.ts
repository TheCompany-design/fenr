/**
 * Trigger detection for `/` commands and `@` references.
 *
 * Pure and headless: it takes text plus a caret offset and answers "is the
 * user mid-trigger, and what have they typed so far". No DOM, no React, so it
 * can be tested exhaustively — which matters, because the failure mode is
 * silent: a false negative just means no menu appears, but a false positive
 * means the menu hijacks the Enter key the user wanted for a newline.
 */

export type TriggerKind = "slash" | "mention"

export type Trigger = {
  kind: TriggerKind
  /** Offset of the trigger character itself. */
  from: number
  /** Caret offset; the query spans `from + 1 .. to`. */
  to: number
  /** What the user typed after the trigger character. */
  query: string
}

/**
 * `/` only opens a menu after whitespace or at the start of a line, so paths
 * like `src/lib/store.ts` and URLs do not open one mid-word.
 */
const SLASH = /(^|[\s(])(\/)([\w-]*)$/

/**
 * `@` requires a non-word character before it. Without that guard the
 * overwhelmingly common case of typing an email address opens the menu at the
 * `@`, and the user cannot get rid of it except by pressing Escape.
 */
const MENTION = /(^|[^\w@])@([\w./~-]*)$/

/**
 * An odd number of fences before the caret means the caret is inside a code
 * block. Menus there are noise: inside a fence the user is almost always
 * typing literal text, and the `@` in a decorator or the `/` in a regex is
 * exactly the character that would otherwise trigger.
 */
function insideFence(text: string, caret: number): boolean {
  const fences = text.slice(0, caret).match(/```/g)
  return fences !== null && fences.length % 2 === 1
}

/** A span already resolved into a mention must not re-trigger mid-edit. */
function insideResolved(
  spans: readonly { start: number; end: number }[],
  caret: number,
): boolean {
  return spans.some((span) => caret > span.start && caret <= span.end)
}

export function detectTrigger(input: {
  text: string
  caret: number
  /** Spans of already-committed mentions, so editing inside one is safe. */
  spans?: readonly { start: number; end: number }[]
}): Trigger | null {
  const { text, caret } = input
  if (caret <= 0 || caret > text.length) return null
  if (insideFence(text, caret)) return null
  if (insideResolved(input.spans ?? [], caret)) return null

  const before = text.slice(0, caret)

  const mention = MENTION.exec(before)
  if (mention) {
    // `match.index` points at the guard character; the `@` follows it.
    const at = mention.index + mention[1].length
    return { kind: "mention", from: at, to: caret, query: mention[2] }
  }

  const slash = SLASH.exec(before)
  if (slash) {
    // Group 1 is the guard character, group 2 the slash, group 3 the query.
    const at = slash.index + slash[1].length
    return { kind: "slash", from: at, to: caret, query: slash[3] }
  }

  return null
}

/**
 * Rewrites the text so a chosen item replaces the trigger span, and reports
 * the span it occupies. The span is recorded rather than trusted later: the
 * store revalidates it against the text on every edit, which is what lets a
 * mention survive unrelated typing and die when its own text is changed.
 */
export function applySelection(input: {
  text: string
  trigger: Trigger
  insertText: string
  /** Extra whitespace so the next token is not glued to the inserted word. */
  trailingSpace?: boolean
}): { text: string; start: number; end: number } {
  const { text, trigger, insertText } = input
  const suffix = input.trailingSpace === false ? "" : " "

  // Replacing `/que` with `/queue ` leaves the user positioned after the
  // item, ready to keep typing — not before it, which would require an arrow
  // key they have no reason to know they need.
  const next = `${text.slice(0, trigger.from)}${insertText}${suffix}${text.slice(trigger.to)}`
  return {
    text: next,
    start: trigger.from,
    end: trigger.from + insertText.length,
  }
}

/**
 * Scores an item against a query. Subsequence matching, so `gpt` ranks
 * `gpt-6-astra` highly and `ada.pt` still finds it, with consecutive and
 * prefix hits rewarded so the obvious answer sorts first.
 */
export function scoreMatch(haystack: string, query: string): number | null {
  if (!query) return 0
  const target = haystack.toLowerCase()
  const needle = query.toLowerCase()

  const direct = target.indexOf(needle)
  if (direct === 0) return 1000
  if (direct > 0) return 700 - direct

  let score = 0
  let cursor = 0
  let streak = 0
  for (const char of needle) {
    const found = target.indexOf(char, cursor)
    if (found === -1) return null
    streak = found === cursor ? streak + 1 : 0
    score += 10 + streak * 5 - Math.min(found - cursor, 12)
    cursor = found + 1
  }
  return score
}

export function filterItems<T>(
  items: readonly T[],
  query: string,
  toText: (item: T) => string,
): T[] {
  if (!query) return [...items]
  return items
    .map((item) => ({ item, score: scoreMatch(toText(item), query) }))
    .filter(
      (entry): entry is { item: T; score: number } => entry.score !== null,
    )
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.item)
}
