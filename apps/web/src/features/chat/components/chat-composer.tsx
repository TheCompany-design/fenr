import { SentIcon, StopCircleIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useForm } from "@tanstack/react-form"
import { useCallback, useEffect, useRef } from "react"
import {
  type ChatComposerInput,
  chatComposerSchema,
} from "@/lib/schemas/agent-stream"
import { useChatStore } from "../state/chat-store"

export interface ChatComposerProps {
  readonly onSend: (prompt: string) => void | Promise<void>
  readonly onStop: () => void
  readonly isStreaming?: boolean
  readonly placeholder?: string
  readonly suggestions?: readonly string[]
}

const DEFAULT_SUGGESTIONS = [
  "Check system health",
  "Run reconciliation match",
  "Summarize summer sales trends",
] as const

/**
 * Message composer adapted from Beautiful UI ChatComposer and Prompt Bar primitives.
 * Integrates TanStack Form with Zod validation, Enter-to-send keyboard handling,
 * and dynamic send/stop action state.
 */
export function ChatComposer({
  onSend,
  onStop,
  isStreaming = false,
  placeholder = "Message Nabu agent... (Enter to send, Shift+Enter for new line)",
  suggestions = DEFAULT_SUGGESTIONS,
}: ChatComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const draftPrompt = useChatStore((state) => state.draftPrompt)
  const setDraftPrompt = useChatStore((state) => state.setDraftPrompt)
  const resetDraft = useChatStore((state) => state.resetDraft)

  const form = useForm({
    defaultValues: {
      prompt: draftPrompt || "",
    } as ChatComposerInput,
    validators: {
      onChange: chatComposerSchema,
    },
    onSubmit: async ({ value }) => {
      const trimmed = value.prompt.trim()
      if (!trimmed || isStreaming) return
      resetDraft()
      form.reset()
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto"
      }
      await onSend(trimmed)
    },
  })

  // Auto-resize textarea height smoothly
  const adjustHeight = useCallback(() => {
    const el = textareaRef.current
    if (el) {
      el.style.height = "auto"
      el.style.height = `${Math.min(el.scrollHeight, 200)}px`
    }
  }, [])

  // Adjust on initial load if pre-filled draft
  useEffect(() => {
    adjustHeight()
  }, [adjustHeight])

  const handleSuggestionClick = (suggestion: string) => {
    form.setFieldValue("prompt", suggestion)
    setDraftPrompt(suggestion)
    if (textareaRef.current) {
      textareaRef.current.focus()
      adjustHeight()
    }
  }

  return (
    <div className="flex w-full flex-col gap-2">
      {/* Suggestions / Prompt pills */}
      {suggestions.length > 0 && !isStreaming && (
        <div className="flex flex-wrap items-center justify-center gap-1.5 px-1">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => handleSuggestionClick(suggestion)}
              className="rounded-full border border-border/80 bg-background/80 px-2.5 py-1 text-xs text-muted-foreground shadow-xs backdrop-blur-xs transition-colors hover:border-foreground/20 hover:bg-muted hover:text-foreground"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {/* Main Composer Box */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          e.stopPropagation()
          void form.handleSubmit()
        }}
        className="relative flex flex-col rounded-2xl border border-border/80 bg-background/90 p-2.5 shadow-lg backdrop-blur-md transition-colors focus-within:border-foreground/40 focus-within:ring-1 focus-within:ring-foreground/10 dark:bg-card/90"
      >
        <form.Field name="prompt">
          {(field) => (
            <textarea
              ref={textareaRef}
              name={field.name}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => {
                field.handleChange(e.target.value)
                setDraftPrompt(e.target.value)
                adjustHeight()
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  if (!isStreaming && field.state.value.trim().length > 0) {
                    void form.handleSubmit()
                  }
                }
              }}
              placeholder={placeholder}
              rows={1}
              className="max-h-[200px] min-h-[44px] w-full resize-none bg-transparent px-2 py-1.5 text-[13px] leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:outline-hidden"
            />
          )}
        </form.Field>

        <div className="flex items-center justify-between pt-1">
          <span className="px-2 text-[11px] text-muted-foreground/60">
            {isStreaming ? "Agent is typing..." : "Markdown supported"}
          </span>

          <form.Subscribe
            selector={(state) => [state.values.prompt, state.isSubmitting]}
          >
            {([prompt]) => {
              const canSend =
                typeof prompt === "string" && prompt.trim().length > 0
              return (
                <div className="flex items-center gap-1.5">
                  {isStreaming ? (
                    <button
                      type="button"
                      aria-label="Stop generating"
                      onClick={onStop}
                      className="flex size-8 items-center justify-center rounded-xl bg-destructive text-destructive-foreground transition-transform hover:opacity-90 active:scale-95"
                    >
                      <HugeiconsIcon icon={StopCircleIcon} size={16} />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      aria-label="Send message"
                      disabled={!canSend}
                      className="flex size-8 items-center justify-center rounded-xl bg-foreground text-background transition-[opacity,transform] disabled:cursor-not-allowed disabled:opacity-30 enabled:hover:opacity-90 enabled:active:scale-95"
                    >
                      <HugeiconsIcon icon={SentIcon} size={16} />
                    </button>
                  )}
                </div>
              )
            }}
          </form.Subscribe>
        </div>
      </form>
    </div>
  )
}
