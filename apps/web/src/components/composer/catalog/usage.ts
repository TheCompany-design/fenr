import type { Attachment } from "./attachments"
import type { ResolvedCaps } from "./capabilities"

/**
 * Token accounting for the context meter.
 *
 * Deliberately an estimate. Real counts only exist once a provider returns
 * `usage` for a request that already happened, so the honest split is:
 *
 *   history    — seeded from the last real `usage`, then counted forward
 *   draft      — estimated on every keystroke
 *   tools      — estimated from the enabled schemas
 *   attachments— estimated per kind
 *
 * The meter is a pressure gauge, not a bill. It only has to be right enough
 * that the warning appears before the request fails.
 */

export type ContextBreakdown = {
  system: number
  tools: number
  history: number
  attachments: number
  draft: number
}

export type ContextUsage = {
  breakdown: ContextBreakdown
  /** Total tokens against the selected model's context window. */
  used: number
  window: number
  /** `used / window`, not clamped — the UI needs to know it went past 1. */
  ratio: number
  /** Tokens over the limit; 0 when it fits. */
  overflow: number
}

export type MeteredMessage = {
  content: string
  attachments?: Attachment[]
  /** Real provider-reported token count, when one was returned. */
  usage?: number
}

/** ~4 characters per token holds for English prose and most code. */
function estimateText(text: string): number {
  return Math.ceil(text.length / 4)
}

/**
 * Image tokens scale with resolution and are wildly provider-dependent
 * (~1,600 for a typical Claude image). A flat constant over-estimates small
 * images, which is the safe direction for a meter.
 */
function estimateAttachment(attachment: Attachment): number {
  if (attachment.mimeType.startsWith("image/")) return 1_600
  if (attachment.mimeType === "application/pdf") {
    return Math.max(200, Math.ceil(attachment.size / 3_000))
  }
  return estimateText(attachment.name)
}

/**
 * Tool schemas are real tokens in the request. This under-counts a verbose
 * schema badly, but it is enough to make "3 tools enabled" visibly move the
 * meter rather than sitting there looking free.
 */
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
  /**
   * Provider-reported input tokens for the last completed request, when one
   * exists. The provider's count is ground truth — it covers the system
   * prompt, the tool schemas, and every message up to the last completed
   * reply — so when present it *replaces* the estimate for all of that, and
   * only what arrived afterwards is estimated. This is the meter's own
   * documented split: history seeded from the last real usage, then counted
   * forward. Estimates remain the only pre-flight option; they are never
   * mixed into a number a provider already reported.
   */
  historySeed?: number
}): ContextUsage {
  const { caps, systemPrompt, messages, draft, historySeed } = input

  const window = caps.model?.limits.contextWindow ?? 0

  const system = estimateText(systemPrompt)
  const tools = (input.toolIds ?? []).reduce(
    (sum, toolId) => sum + estimateToolSchema(toolId),
    0,
  )

  // A seed covers the system prompt and tool schemas too — the provider
  // counted the whole request — so those two estimates are subtracted back
  // out of the breakdown rather than double-counted on top of the seed. What
  // arrived after the seeded request is still estimated on top of it.
  const messageEstimate = messages.reduce((total, message) => {
    if (typeof message.usage === "number") return total + message.usage
    const own =
      estimateText(message.content) +
      (message.attachments ?? []).reduce(
        (sum, attachment) => sum + estimateAttachment(attachment),
        0,
      )
    // Every message carries role and framing overhead that raw text misses.
    return total + own + 4
  }, 0)

  const history = historySeed
    ? Math.max(0, historySeed - system - tools) + messageEstimate
    : messageEstimate

  const attachments = (input.pendingAttachments ?? []).reduce(
    (sum, attachment) => sum + estimateAttachment(attachment),
    0,
  )

  // A mention is text the user sees but the model receives as a resolved
  // payload, so only the handle is counted here — the file's own cost arrives
  // with the attachment above.
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
