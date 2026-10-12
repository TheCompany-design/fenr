import { useEffect } from "react"

type ShortcutHandlers = {
  onModel?: () => void
  onTools?: () => void
  onSubmit?: () => void
}

/**
 * Document-level shortcuts for the composer.
 *
 * Bound at the document rather than on the textarea so they still work when
 * focus sits on a tool chip or the send button — which is where the user
 * actually is when they reach for ⌘⇧P. An effect is genuinely the right tool
 * here: a listener has to be attached while mounted and detached when not,
 * and there is no render-phase equivalent.
 */
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
