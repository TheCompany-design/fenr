import { ArrowRight01Icon, StopCircleIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useForm } from "@tanstack/react-form"
import {
  type ChatComposerInput,
  chatComposerSchema,
} from "@/lib/schemas/agent-stream"

export interface ChatComposerProps {
  readonly onSend: (prompt: string) => void | Promise<void>
  readonly onStop: () => void
  readonly isStreaming?: boolean
  readonly placeholder?: string
  readonly suggestions?: readonly string[]
  /**
   * Whether to offer the prompt row at all.
   *
   * Off once a conversation exists: the prompts are a way in, and a way someone
   * has already taken is just noise under a live transcript.
   */
  readonly showSuggestions?: boolean
}

const DEFAULT_SUGGESTIONS = [
  "Check system health",
  "Run reconciliation match",
  "Summarize summer sales trends",
] as const

/**
 * Message composer adapted from Beautiful UI ChatComposer and Prompt Bar primitives.
 * Integrates TanStack Form with Zod validation, declarative CSS field-sizing,
 * Enter-to-send keyboard handling, and dynamic send/stop action state.
 *
 * Two nested surfaces on purpose: a panel that holds the input and the
 * suggestion row, and the input itself inside it. That way the suggestions have
 * a home that belongs to the composer instead of floating over the
 * conversation — a supplementary row positioned above the thing it decorates
 * is what swallows clicks and keystrokes aimed at the textarea.
 */
export function ChatComposer({
  onSend,
  onStop,
  isStreaming = false,
  placeholder = "Ask about a reconciliation, ledger balance, or workflow…",
  showSuggestions = true,
  suggestions = DEFAULT_SUGGESTIONS,
}: ChatComposerProps) {
  const form = useForm({
    defaultValues: {
      prompt: "",
    } as ChatComposerInput,
    validators: {
      onChange: chatComposerSchema,
    },
    onSubmit: async ({ value }) => {
      const trimmed = value.prompt.trim()
      if (!trimmed || isStreaming) return
      form.reset()
      await onSend(trimmed)
    },
  })

  const handleSuggestionClick = (suggestion: string) => {
    form.setFieldValue("prompt", suggestion)
  }

  return (
    <div className="flex w-full flex-col">
      <div
        className="flex flex-col rounded-4xl border border-border/60 bg-card/50 p-0.5 shadow-xs backdrop-blur-md transition-colors focus-within:border-foreground/25"
        data-slot="composer-panel"
      >
        {/* Input surface */}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            void form.handleSubmit()
          }}
          className="flex flex-col rounded-3xl border border-border/70 bg-background p-3"
          data-slot="composer-input"
        >
          <form.Field name="prompt">
            {(field) => (
              <textarea
                name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
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
                className="max-h-[200px] min-h-[44px] w-full resize-none field-sizing-content bg-transparent text-[13px] leading-relaxed text-foreground placeholder:text-muted-foreground/50 focus:outline-hidden"
              />
            )}
          </form.Field>

          <div className="flex items-center justify-between pt-2">
            <span className="text-[11px] text-muted-foreground/60">
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
                        className="flex size-8 items-center justify-center rounded-full bg-destructive text-destructive-foreground transition-transform hover:opacity-90 active:scale-95"
                      >
                        <HugeiconsIcon icon={StopCircleIcon} size={16} />
                      </button>
                    ) : (
                      <button
                        type="submit"
                        aria-label="Send message"
                        disabled={!canSend}
                        className="flex size-8 items-center justify-center rounded-full bg-foreground text-background transition-[opacity,transform] disabled:cursor-not-allowed disabled:opacity-30 enabled:hover:opacity-90 enabled:active:scale-95"
                      >
                        <HugeiconsIcon icon={ArrowRight01Icon} size={16} />
                      </button>
                    )}
                  </div>
                )
              }}
            </form.Subscribe>
          </div>
        </form>

        {/* Prompts, inside the panel and below the input */}
        {showSuggestions && suggestions.length > 0 && !isStreaming && (
          <div
            className="flex flex-wrap items-center justify-center gap-1.5 px-1 pt-2"
            data-slot="composer-suggestions"
          >
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => handleSuggestionClick(suggestion)}
                className="rounded-full border border-border/60 bg-background/60 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
