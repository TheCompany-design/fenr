import { useEffect, useMemo, useRef } from "react"
import { type MeteredMessage, measureContext } from "../catalog/usage"
import { usePromptStore } from "../state/prompt-store"

export type ConversationSnapshot = {
  systemPrompt: string
  messages: MeteredMessage[]

  historySeed?: number
}

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
  }, [caps, text, mentions, attachments, toolIds, source])

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
