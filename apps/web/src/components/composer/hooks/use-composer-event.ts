import { useEffect } from "react"

/**
 * Subscribes to one of the composer's window events.
 *
 * Commands and shortcuts do not import the surfaces they open — that would
 * cycle the module graph — so they dispatch `composer:*` window events and
 * the surface that owns the affordance listens here. The document-level
 * subscription also means the shortcut works while focus sits on a chip or
 * the send button rather than only inside the textarea.
 */
export function useComposerEvent(event: string, handler: () => void): void {
  useEffect(() => {
    const listener = () => handler()
    window.addEventListener(event, listener)
    return () => window.removeEventListener(event, listener)
  }, [event, handler])
}
