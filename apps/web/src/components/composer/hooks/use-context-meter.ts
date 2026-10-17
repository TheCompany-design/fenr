import { useEffect, useMemo, useRef } from "react"
import { type MeteredMessage, measureContext } from "../catalog/usage"
import { usePromptStore } from "../state/prompt-store"

export type ConversationSnapshot = {
  systemPrompt: string
  messages: MeteredMessage[]
  /**
   * Provider-reported input tokens for the last completed request. When
   * present, `messages` should contain only what arrived *after* the request
   * it covers — the seed already counts everything before it.
   */
  historySeed?: number
}

/**
 * Feeds the context meter from outside the store.
 *
 * The store owns the composer; it does not own the conversation. That split is
 * deliberate — the transcript belongs to the query cache, which has real
 * invalidation and hydration, while the composer is cache-only UI state.
 * Mirroring the transcript into the store would leave two copies of it and no
 * clear owner.
 *
 * So the meter is computed at the seam and pushed in as a measurement. This is
 * the one place in the composer that uses an effect, and the reason is worth
 * stating: the value is *derived from props outside the store and stored
 * elsewhere*, which no render-phase computation can do without writing to a
 * store before the component has committed. Writing during render would notify
 * subscribers mid-render, which is how you get tearing.
 */
/**
 * Fallback only. A host app supplies its own system prompt through the bridge,
 * so this is what the meter reports before one is configured — a slightly
 * wrong system-prompt estimate is harmless, but importing one from the host
 * would make the folder un-portable.
 */
const FALLBACK_SYSTEM_PROMPT = "You are a helpful assistant."

export function useContextMeter(source: () => ConversationSnapshot): void {
  const caps = usePromptStore((s) => s.caps)
  const text = usePromptStore((s) => s.text)
  const mentions = usePromptStore((s) => s.mentions)
  const attachments = usePromptStore((s) => s.attachments)
  const toolIds = usePromptStore((s) => s.toolIds)
  const setUsage = usePromptStore((s) => s.setUsage)

  const usage = useMemo(() => {
    const { systemPrompt, messages, historySeed } = source()
    return measureContext({
      caps,
      systemPrompt: systemPrompt || FALLBACK_SYSTEM_PROMPT,
      messages,
      draft: text,
      mentions,
      pendingAttachments: attachments,
      toolIds,
      historySeed,
    })
    // `source` is read every render on purpose — the transcript is fetched
    // through a getter, so its identity never changes and a dependency on it
    // would miss updates entirely.
  }, [caps, text, mentions, attachments, toolIds, source])

  // Guards against the effect re-running forever when the store rejects a
  // measurement as unchanged: the ref remembers what was last *offered*, not
  // what was last stored. The comparison covers the whole measurement, not
  // just the total — a guard on `used` alone silently dropped the update
  // where a model resolved and every token count stayed identical, so the
  // meter kept reporting the old (window 0) measurement and a phantom
  // context-overflow blocker outlived the model it was measured against.
  const lastOffered = useRef<number | null>(null)

  useEffect(() => {
    const current = usePromptStore.getState().usage
    if (
      current &&
      current.used === usage.used &&
      current.window === usage.window &&
      lastOffered.current === usage.used
    ) {
      return
    }
    lastOffered.current = usage.used
    setUsage(usage)
  }, [usage, setUsage])
}
