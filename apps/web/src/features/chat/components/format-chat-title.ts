import type { ChatMessage } from "../types"

export const CHAT_TITLE_MAX_LENGTH = 48

export function formatPromptTitle(prompt: string | null | undefined): string {
  if (!prompt) {
    return ""
  }

  const line = prompt.trim().replace(/\s+/g, " ")
  if (!line) {
    return ""
  }

  const characters = Array.from(line)

  if (characters.length <= CHAT_TITLE_MAX_LENGTH) {
    return line
  }

  const clipped = characters.slice(0, CHAT_TITLE_MAX_LENGTH)
  const lastSpace = clipped.lastIndexOf(" ")

  const stem =
    lastSpace > CHAT_TITLE_MAX_LENGTH / 2
      ? clipped.slice(0, lastSpace)
      : clipped

  return `${stem.join("").trimEnd()}…`
}

export function formatChatTitle(
  messages: readonly ChatMessage[] | null | undefined,
): string {
  const prompt = messages?.find(
    (message) => message.role === "user" && message.content.trim().length > 0,
  )?.content

  return formatPromptTitle(prompt)
}
