import { useEffect } from "react"

type ShortcutHandlers = {
  onModel?: () => void
  onTools?: () => void
  onSubmit?: () => void
}

export function useComposerShortcuts(handlers: ShortcutHandlers): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey

      if (mod && event.shiftKey && event.key.toLowerCase() === "p") {
        event.preventDefault()
        handlers.onModel?.()
        return
      }
      if (mod && event.shiftKey && event.key.toLowerCase() === "t") {
        event.preventDefault()
        handlers.onTools?.()
        return
      }
      if (mod && event.key === "Enter") {
        event.preventDefault()
        handlers.onSubmit?.()
      }
    }

    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [handlers])
}
