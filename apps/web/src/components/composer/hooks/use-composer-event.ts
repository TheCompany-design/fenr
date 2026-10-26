import { useEffect } from "react"

export function useComposerEvent(event: string, handler: () => void): void {
  useEffect(() => {
    const listener = () => handler()
    window.addEventListener(event, listener)
    return () => window.removeEventListener(event, listener)
  }, [event, handler])
}
