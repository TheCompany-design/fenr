import type { ChatMessage } from "../types"

export interface ChatTurn {
  readonly messages: readonly ChatMessage[]
  readonly isUser: boolean
  readonly isStreaming: boolean
}

export function groupIntoTurns(messages: readonly ChatMessage[]): ChatTurn[] {
  const turns: ChatTurn[] = []

  for (const message of messages) {
    const previous = turns.at(-1)
    const isUser = message.role === "user"

    if (previous && previous.isUser === isUser) {
      turns[turns.length - 1] = {
        ...previous,
        messages: [...previous.messages, message],

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

export function turnThinking(messages: readonly ChatMessage[]): string {
  return messages
    .map((message) => (message.thinking ?? "").trim())
    .filter((thinking) => thinking.length > 0)
    .join("\n\n")
}

export function turnText(messages: readonly ChatMessage[]): string {
  return messages
    .map((message) => message.content.trim())
    .filter((content) => content.length > 0)
    .join("\n\n")
}
