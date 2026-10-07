import type { ChatMessage } from "../types"

/** Long enough to name a thread, short enough to survive a slim top bar. */
export const CHAT_TITLE_MAX_LENGTH = 48

/**
 * Placeholder thread title, derived from the transcript.
 *
 * Title generation is not implemented yet. `agent_threads.title` is the column
 * that will eventually carry a generated name — it is nullable and nothing
 * writes it today — so until then a thread is named after the first thing its
 * author asked. A clean chat has no user message to name it after and returns
 * an empty string, which is what keeps the header blank until the first prompt.
 *
 * The result is a single line: prompts arrive with hard breaks in them, and a
 * header is not a place to preserve them.
 */
export function formatChatTitle(
  messages: readonly ChatMessage[] | null | undefined,
): string {
  // The first user message that actually says something. Skipping empty ones
  // costs nothing and keeps a transcript with an empty leading turn from
  // claiming the thread has no name.
  const prompt = messages?.find(
    (message) => message.role === "user" && message.content.trim().length > 0,
  )?.content

  if (!prompt) {
    return ""
  }

  const line = prompt.trim().replace(/\s+/g, " ")
  // Count code points, not UTF-16 units: slicing by unit can cut a surrogate
  // pair in half and leave the header rendering a replacement glyph.
  const characters = Array.from(line)

  if (characters.length <= CHAT_TITLE_MAX_LENGTH) {
    return line
  }

  const clipped = characters.slice(0, CHAT_TITLE_MAX_LENGTH)
  const lastSpace = clipped.lastIndexOf(" ")
  // Cut at the last space so the title ends on a word, but only when that does
  // not throw away most of the budget — a single long token ("https://…") has
  // no spaces to cut at and must still be clipped.
  const stem =
    lastSpace > CHAT_TITLE_MAX_LENGTH / 2
      ? clipped.slice(0, lastSpace)
      : clipped

  return `${stem.join("").trimEnd()}…`
}
