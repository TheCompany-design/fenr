import { useCallback, useEffect } from "react"
import type { MeteredMessage } from "./catalog/usage"
import { Composer } from "./composer"
import { useContextMeter } from "./hooks/use-context-meter"
import type { SendPayload } from "./state/prompt-store"
import { usePromptStore } from "./state/prompt-store"

export type ComposerBridge = {
  conversation: () => {
    systemPrompt: string
    messages: MeteredMessage[]

    historySeed?: number
  }

  send: (payload: SendPayload) => void

  onSettled: (status: "ready" | "error") => void

  stop?: () => void
}

export function ComposerMount({ bridge }: { bridge: ComposerBridge }) {
  const hydrate = usePromptStore((s) => s.hydrate)
  const setTransport = usePromptStore((s) => s.setTransport)

  const started = useCallback(() => {
    void hydrate()
  }, [hydrate])
  useEffect(started, [started])

  useEffect(() => {
    setTransport(bridge)
  }, [bridge, setTransport])

  const snapshot = useCallback(() => bridge.conversation(), [bridge])
  useContextMeter(snapshot)

  return <Composer />
}
