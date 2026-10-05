import type { ChatMessage } from "../types"

/**
 * One assistant reply: everything said across a single turn.
 *
 * A turn that calls a tool produces one message per model step, and rendering
 * each as its own bubble gave a single reply a separate avatar, name and
 * timestamp per step. It read as several turns, which is what it is not: the
 * model was still answering the same question, and only the plumbing between
 * its steps was visible.
 */
export interface ChatTurn {
  readonly messages: readonly ChatMessage[]
  readonly isUser: boolean
  readonly isStreaming: boolean
}

/**
 * Groups the timeline into turns.
 *
 * Consecutive agent messages are one turn, always: a turn starts with a person
 * and ends before the next one does, so a run of agent messages cannot span
 * two. That makes the grouping hold without threading a turn identifier
 * through the store, and it survives a reload, where the transcript arrives as
 * the same contiguous run.
 *
 * Steps that produced no text — a step that only called a tool — are kept
 * rather than dropped: their reasoning is part of the turn, and dropping them
 * would lose it.
 */
export function groupIntoTurns(messages: readonly ChatMessage[]): ChatTurn[] {
  const turns: ChatTurn[] = []

  for (const message of messages) {
    const previous = turns.at(-1)
    const isUser = message.role === "user"

    if (previous && previous.isUser === isUser) {
      turns[turns.length - 1] = {
        ...previous,
        messages: [...previous.messages, message],
        // Liveness follows the newest step. A finished step followed by another
        // finished step has settled the turn; accumulating "any step was ever
        // streaming" would leave a completed reply marked live forever.
        isStreaming: message.status === "streaming",
      }
      continue
    }

    turns.push({
      messages: [message],
      isUser,
      isStreaming: message.status === "streaming",
    })
  }

  return turns
}

/**
 * The reasoning for a whole turn, with each step kept apart.
 *
 * Joined rather than concatenated: two steps' reasoning run together read as
 * one continuous thought, which is the thing that made a turn look like it had
 * lost its thread. A blank line between steps keeps the boundary visible
 * without implying a new turn.
 */
export function turnThinking(messages: readonly ChatMessage[]): string {
  return messages
    .map((message) => (message.thinking ?? "").trim())
    .filter((thinking) => thinking.length > 0)
    .join("\n\n")
}

/** What a turn actually said: the steps that produced text. */
export function turnText(messages: readonly ChatMessage[]): string {
  return messages
    .map((message) => message.content.trim())
    .filter((content) => content.length > 0)
    .join("\n\n")
}
