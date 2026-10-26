import type { Attachment } from "./attachments"
import type { ResolvedCaps } from "./capabilities"

export type ContextBreakdown = {
  system: number
  tools: number
  history: number
  attachments: number
  draft: number
}

export type ContextUsage = {
  breakdown: ContextBreakdown

  used: number
  window: number

  ratio: number

  overflow: number
}

export type MeteredMessage = {
  content: string
  attachments?: Attachment[]

  usage?: number
}

function estimateText(text: string): number {
  return Math.ceil(text.length / 4)
}

function estimateAttachment(attachment: Attachment): number {
  if (attachment.mimeType.startsWith("image/")) return 1_600
  if (attachment.mimeType === "application/pdf") {
    return Math.max(200, Math.ceil(attachment.size / 3_000))
  }
  return estimateText(attachment.name)
}

function estimateToolSchema(toolId: string): number {
  return 120 + Math.ceil(toolId.length / 2)
}

export function measureContext(input: {
  caps: ResolvedCaps
  systemPrompt: string
  messages: readonly MeteredMessage[]
  draft: string
  mentions?: readonly { insertText: string }[]
  pendingAttachments?: readonly Attachment[]
  toolIds?: readonly string[]

  historySeed?: number
}): ContextUsage {
  const { caps, systemPrompt, messages, draft, historySeed } = input

  const window = caps.model?.limits.contextWindow ?? 0

  const system = estimateText(systemPrompt)
  const tools = (input.toolIds ?? []).reduce(
    (sum, toolId) => sum + estimateToolSchema(toolId),
    0,
  )

  const messageEstimate = messages.reduce((total, message) => {
    if (typeof message.usage === "number") return total + message.usage
    const own =
      estimateText(message.content) +
      (message.attachments ?? []).reduce(
        (sum, attachment) => sum + estimateAttachment(attachment),
        0,
      )

    return total + own + 4
  }, 0)

  const history = historySeed
    ? Math.max(0, historySeed - system - tools) + messageEstimate
    : messageEstimate

  const attachments = (input.pendingAttachments ?? []).reduce(
    (sum, attachment) => sum + estimateAttachment(attachment),
    0,
  )

  const mentionCost = (input.mentions ?? []).reduce(
    (sum, mention) => sum + estimateText(mention.insertText),
    0,
  )

  const breakdown: ContextBreakdown = {
    system,
    tools,
    history,
    attachments,
    draft: estimateText(draft) + mentionCost,
  }

  const used = Object.values(breakdown).reduce((sum, value) => sum + value, 0)

  return {
    breakdown,
    used,
    window,
    ratio: window > 0 ? used / window : 0,
    overflow: Math.max(0, used - window),
  }
}
