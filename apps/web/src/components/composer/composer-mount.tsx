import { useCallback, useEffect } from "react"
import type { MeteredMessage } from "./catalog/usage"
import { Composer } from "./composer"
import { useContextMeter } from "./hooks/use-context-meter"
import type { SendPayload } from "./state/prompt-store"
import { usePromptStore } from "./state/prompt-store"

/**
 * Everything the composer needs from its host, expressed as one object.
 *
 * The composer is deliberately unaware of the query cache, the server
 * function, and the router. This mount is the seam: the app supplies the
 * transcript and a transport, and the composer's state machine never learns
 * where either came from. That is what lets the same composer run against the
 * playground's dummy backend and the real app's providers.
 */
export type ComposerBridge = {
  /** Current transcript, read fresh on every render. */
  conversation: () => {
    systemPrompt: string
    messages: MeteredMessage[]
    /** Provider-reported input tokens for the last completed request. */
    historySeed?: number
  }
  /** Performs the send. Owns streaming, cancellation, and error states. */
  send: (payload: SendPayload) => void
  /** Fired when the transport settles, so the store can leave `submitted`. */
  onSettled: (status: "ready" | "error") => void
  /**
   * Stops the in-flight send. Optional: the store tolerates a transport that
   * cannot be interrupted, but a streaming one should supply it — the stop
   * button is a lie otherwise.
   */
  stop?: () => void
}

export function ComposerMount({ bridge }: { bridge: ComposerBridge }) {
  const hydrate = usePromptStore((s) => s.hydrate)
  const setTransport = usePromptStore((s) => s.setTransport)

  // Providers load once per mount. Guarded so a StrictMode double render does
  // not issue two catalog fetches per provider.
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
